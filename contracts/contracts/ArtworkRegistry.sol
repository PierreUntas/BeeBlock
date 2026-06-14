// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IArtworkTokenization
 * @dev Interface for the ArtworkTokenization contract
 */
interface IArtworkTokenization {
    function mintArtworkEdition(
        address artist,
        uint256 amount,
        string memory uri
    ) external returns (uint256);

    function balanceOf(
        address account,
        uint256 id
    ) external view returns (uint256);

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external;

    function tokenArtist(uint256 tokenId) external view returns (address);

    function isApprovedForAll(
        address account,
        address operator
    ) external view returns (bool);

    function updateTokenMetadata(uint256 tokenId, string memory newMetadata) external;

    function uri(uint256 tokenId) external view returns (string memory);
}

/**
 * @title ArtworkRegistry
 * @dev Main contract for artwork certification system using Merkle Tree for secure certificate distribution
 * @notice This contract manages artists, artwork editions, and certificate claims using cryptographic proofs
 *
 * The contract implements a three-tier authorization system:
 * 1. Owner can add/remove admins
 * 2. Admins can authorize artists
 * 3. Authorized artists can create artwork editions
 *
 * Certificate distribution uses Merkle Tree proofs for gas-efficient and secure claiming.
 */
contract ArtworkRegistry is Ownable, ReentrancyGuard {
    // ============ CONFIGURATION VARIABLES ============

    /// @dev Maximum number of certificates that can be minted in a single edition
    uint256 public maxEditionSize = 100_000;

    /// @dev Maximum number of reviews a user can add per edition
    uint256 public maxReviewsPerUserAndEdition = 5;

    /// @dev Maximum number of reviews returned in a single query
    uint256 public maxReviewsQuery = 100;

    // ============ STRUCTS ============

    /**
     * @dev Structure representing an artist
     * @param authorized Whether the artist is authorized to create editions
     * @param metadata IPFS CID pointing to artist information JSON (name, location, bio, portfolio, website, etc.)
     */
    struct Artist {
        bool authorized;
        string metadata;
    }

    /**
     * @dev Structure representing an artwork edition
     * @param merkleRoot Root hash of the Merkle Tree containing all secret keys for this edition
     * @param disabled Whether the edition has been disabled by an admin
     *
     * Note: the immutability invariant on metadata is enforced via the
     * `initialEditionSize` mapping and the artist's current ERC-1155 balance,
     * not via a stored flag.
     */
    struct ArtworkEdition {
        bytes32 merkleRoot;
        bool disabled;
    }

    /**
     * @dev Structure representing a collector review
     * @param collector Address of the collector who left the review
     * @param editionId ID of the edition being reviewed
     * @param rating Numerical rating (0-5)
     * @param metadata IPFS CID pointing to review text in JSON format
     */
    struct Review {
        address collector;
        uint8 rating;
        uint editionId;
        string metadata;
    }

    // ============ STATE VARIABLES ============

    /// @dev Mapping from artist address to their information
    mapping(address => Artist) private artists;

    /// @dev Mapping from edition ID to edition information
    mapping(uint => ArtworkEdition) private artworkEditions;

    /// @dev Mapping from edition ID to its initial mint size, used to enforce the
    ///      metadata-immutability invariant based on the artist's remaining balance.
    mapping(uint256 => uint256) private initialEditionSize;

    /// @dev Mapping from edition ID to array of reviews
    mapping(uint => Review[]) private editionReviews;

    /// @dev Mapping to track admin addresses
    mapping(address => bool) public admins;

    /// @dev Reference to the ArtworkTokenization contract
    IArtworkTokenization public immutable artworkTokenization;

    /**
     * @dev Nested mapping to track claimed keys
     * First key: edition ID
     * Second key: hash of the secret key
     * Value: whether this key has been claimed
     *
     * This prevents double-claiming of the same QR code
     */
    mapping(uint256 => mapping(bytes32 => bool)) private claimedKeys;

    /**
     * @dev Mapping to track number of reviews per user per edition
     * First key: edition ID
     * Second key: user address
     * Value: number of reviews made by the user for that edition
     */
    mapping(uint => mapping(address => uint)) public reviewCount;

    // ============ EVENTS ============

    /**
     * @dev Emitted when a new admin is added
     * @param newAdmin Address of the newly added admin
     */
    event NewAdmin(address indexed newAdmin);

    /**
     * @dev Emitted when an artist's authorization status changes
     * @param artist Address of the artist
     * @param isAuthorized New authorization status
     */
    event AuthorizationArtist(address indexed artist, bool isAuthorized);

    /**
     * @dev Emitted when an admin is removed
     * @param admin Address of the removed admin
     */
    event AdminRemoved(address indexed admin);

    /**
     * @dev Emitted when an artist registers or updates their information
     * @param artist Address of the artist
     */
    event ArtistInfoUpdated(address indexed artist);

    /**
     * @dev Emitted when a new artwork edition is created
     * @param artist Address of the artist who created the edition
     * @param editionId Unique identifier for the edition
     */
    event NewArtworkEdition(address indexed artist, uint indexed editionId);

    /**
     * @dev Emitted when a collector successfully claims an artwork certificate
     * @param collector Address of the collector
     * @param editionId ID of the claimed edition
     */
    event CertificateClaimed(address indexed collector, uint indexed editionId);

    /**
     * @dev Emitted when a collector adds a review to an edition
     * @param collector Address of the collector
     * @param editionId ID of the edition being reviewed
     * @param rating Numerical rating given
     */
    event NewReview(
        address indexed collector,
        uint indexed editionId,
        uint8 rating
    );

    /**
     * @dev Emitted when an artist updates edition metadata
     * @param artist Address of the artist
     * @param editionId ID of the updated edition
     * @param newMetadata New IPFS CID
     */
    event EditionMetadataUpdated(
        address indexed artist,
        uint indexed editionId,
        string newMetadata
    );

    /**
     * @dev Emitted when an edition is disabled by an admin
     * @param editionId ID of the disabled edition
     * @param by Address of the admin who disabled it
     */
    event EditionDisabled(uint256 indexed editionId, address indexed by);

    /**
     * @dev Emitted when an edition's Merkle root is replaced (after a key compromise)
     * @param editionId ID of the edition
     * @param newMerkleRoot The new Merkle root
     */
    event EditionMerkleRootReplaced(uint256 indexed editionId, bytes32 newMerkleRoot);

    /**
     * @dev Emitted when the maximum edition size configuration is updated
     * @param newValue The new maximum edition size
     */
    event MaxEditionSizeUpdated(uint256 newValue);

    /**
     * @dev Emitted when the maximum reviews per user configuration is updated
     * @param newValue The new maximum reviews per user and edition
     */
    event MaxReviewsPerUserAndEditionUpdated(uint256 newValue);

    /**
     * @dev Emitted when the maximum reviews query configuration is updated
     * @param newValue The new maximum reviews query
     */
    event MaxReviewsQueryUpdated(uint256 newValue);

    // ============ ERRORS ============

    /// @dev Thrown when a non-admin tries to perform an admin-only action
    error OnlyAdminAuthorized();

    /// @dev Thrown when trying to set an authorization status that's already set
    error AuthorizationAlreadyApplied();

    /// @dev Thrown when an unauthorized artist tries to perform an artist action
    error ArtistNotAuthorized();

    /// @dev Thrown when a non-certificate-holder tries to review
    error NotAllowedToReview();

    /// @dev Thrown when the Merkle proof verification fails
    error InvalidMerkleProof();

    /// @dev Thrown when trying to claim with an already used secret key
    error KeyAlreadyClaimed();

    /// @dev Thrown when trying to claim but no certificates are left
    error NoCertificateLeft();

    /// @dev Thrown when the edition size exceeds the maximum allowed
    error EditionSizeTooLarge();

    /// @dev Thrown when the rating provided is not between 0 and 5
    error RatingOutOfRange();

    /// @dev Thrown when the review limit per user per edition is reached
    error ReviewLimitReached();

    /// @dev Thrown when an IPFS CID format is invalid
    error InvalidIPFSCID();

    /// @dev Thrown when trying to update metadata after certificates have been claimed
    error MetadataLocked();

    /// @dev Thrown when trying to update metadata for an edition that doesn't exist
    error EditionDoesNotExist();

    /// @dev Thrown when trying to disable an edition that is already disabled
    error EditionAlreadyDisabled();

    /// @dev Thrown when trying to replace the Merkle root of an edition that is not disabled
    error EditionNotDisabled();

    /// @dev Thrown when trying to claim a certificate from a disabled edition
    error EditionIsDisabled();

    /// @dev Thrown when an artist tries to update metadata for an edition they don't own
    error NotYourEdition();

    /// @dev Thrown when trying to create an edition with an empty merkle root
    error EmptyMerkleRoot();

    /// @dev Thrown when trying to create an edition with zero certificates
    error EditionMustHaveCertificates();

    /// @dev Thrown when an artist hasn't approved the contract to transfer their certificates
    error ArtistMustApproveContract();

    /// @dev Thrown when trying to add an admin that already has admin privileges
    error AlreadyAdmin();

    /// @dev Thrown when trying to remove an admin that doesn't have admin privileges
    error NotAnAdmin();

    /// @dev Thrown when the query limit for reviews is too high
    error QueryLimitTooHigh();

    /// @dev Thrown when trying to set an invalid configuration value
    error InvalidConfigValue();

    // ============ MODIFIERS ============

    /**
     * @dev Modifier to restrict function access to admins only
     */
    modifier onlyAdmin() {
        require(admins[msg.sender], OnlyAdminAuthorized());
        _;
    }

    /**
     * @dev Modifier to restrict function access to authorized artists only
     */
    modifier onlyAuthorizedArtist() {
        require(artists[msg.sender].authorized, ArtistNotAuthorized());
        _;
    }

    // ============ CONSTRUCTOR ============

    /**
     * @dev Initializes the contract with the ArtworkTokenization address
     * @param _artworkTokenizationAddress Address of the deployed ArtworkTokenization contract
     *
     * The deployer is automatically set as the owner and first admin
     */
    constructor(address _artworkTokenizationAddress) Ownable(msg.sender) {
        artworkTokenization = IArtworkTokenization(_artworkTokenizationAddress);
        admins[msg.sender] = true;
        emit NewAdmin(msg.sender);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Adds a new admin to the system
     * @param _newAdmin Address to be granted admin privileges
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Address must not already be an admin
     *
     * Emits a {NewAdmin} event
     */
    function addAdmin(address _newAdmin) external onlyOwner {
        require(!admins[_newAdmin], AlreadyAdmin());

        admins[_newAdmin] = true;
        emit NewAdmin(_newAdmin);
    }

    /**
     * @dev Removes an admin from the system
     * @param _admin Address to be removed from admin privileges
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Address must currently be an admin
     *
     * Emits an {AdminRemoved} event
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(admins[_admin], NotAnAdmin());

        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /**
     * @dev Updates the maximum edition size configuration
     * @param _newMaxEditionSize New maximum number of certificates per edition
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Value must be greater than 0
     *
     * Emits a {MaxEditionSizeUpdated} event
     */
    function setMaxEditionSize(uint256 _newMaxEditionSize) external onlyOwner {
        require(_newMaxEditionSize > 0, InvalidConfigValue());
        maxEditionSize = _newMaxEditionSize;
        emit MaxEditionSizeUpdated(_newMaxEditionSize);
    }

    /**
     * @dev Updates the maximum reviews per user configuration
     * @param _newMaxReviewsPerUserAndEdition New maximum reviews per user and edition
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Value must be greater than 0
     *
     * Emits a {MaxReviewsPerUserAndEditionUpdated} event
     */
    function setMaxReviewsPerUserAndEdition(uint256 _newMaxReviewsPerUserAndEdition) external onlyOwner {
        require(_newMaxReviewsPerUserAndEdition > 0, InvalidConfigValue());
        maxReviewsPerUserAndEdition = _newMaxReviewsPerUserAndEdition;
        emit MaxReviewsPerUserAndEditionUpdated(_newMaxReviewsPerUserAndEdition);
    }

    /**
     * @dev Updates the maximum reviews query configuration
     * @param _newMaxReviewsQuery New maximum reviews returned in a single query
     *
     * Requirements:
     * - Caller must be the contract owner
     * - Value must be greater than 0
     *
     * Emits a {MaxReviewsQueryUpdated} event
     */
    function setMaxReviewsQuery(uint256 _newMaxReviewsQuery) external onlyOwner {
        require(_newMaxReviewsQuery > 0, InvalidConfigValue());
        maxReviewsQuery = _newMaxReviewsQuery;
        emit MaxReviewsQueryUpdated(_newMaxReviewsQuery);
    }

    /**
     * @dev Authorizes or revokes authorization for an artist
     * @param _artist Address of the artist
     * @param _isAuthorized True to authorize, false to revoke
     *
     * Requirements:
     * - Caller must be an admin
     * - The authorization status must be different from current status
     *
     * Emits an {AuthorizationArtist} event
     */
    function authorizeArtist(
        address _artist,
        bool _isAuthorized
    ) external onlyAdmin {
        require(
            artists[_artist].authorized != _isAuthorized,
            AuthorizationAlreadyApplied()
        );

        artists[_artist].authorized = _isAuthorized;
        emit AuthorizationArtist(_artist, _isAuthorized);
    }

    // ============ ARTIST FUNCTIONS ============

    /**
     * @dev Allows an authorized artist to register or update their information
     * @param _metadata IPFS CID pointing to artist information JSON (name, location, bio, portfolio, website, etc.)
     *
     * Requirements:
     * - Caller must be an authorized artist
     * - Metadata must be a valid IPFS CID
     *
     * Emits an {ArtistInfoUpdated} event
     */
    function setArtistInfo(
        string memory _metadata
    ) external onlyAuthorizedArtist {
        require(
            bytes(_metadata).length >= 40 && bytes(_metadata).length <= 100,
            InvalidIPFSCID()
        );

        Artist storage artist = artists[msg.sender];
        artist.metadata = _metadata;

        emit ArtistInfoUpdated(msg.sender);
    }

    /**
     * @dev Creates a new artwork edition with Merkle Tree root for secure distribution
     * @param _metadata IPFS CID pointing to edition information JSON (title, year, description, technique, images, etc.)
     * @param _amount Number of certificates to mint for this edition
     * @param _merkleRoot Root hash of the Merkle Tree containing all secret keys
     *
     * The Merkle Tree allows gas-efficient verification of secret keys during claims.
     * Each certificate in the edition corresponds to one secret key in the tree.
     *
     * Requirements:
     * - Caller must be an authorized artist
     * - Artist must have called setApprovalForAll on ArtworkTokenization
     * - Amount must be greater than 0
     * - Amount must not exceed maxEditionSize
     * - Merkle root must not be empty
     * - Metadata must be a valid IPFS CID
     *
     * Emits a {NewArtworkEdition} event
     */
    function createArtworkEdition(
        string memory _metadata,
        uint256 _amount,
        bytes32 _merkleRoot
    ) external onlyAuthorizedArtist {
        require(
            artworkTokenization.isApprovedForAll(msg.sender, address(this)),
            ArtistMustApproveContract()
        );

        require(
            bytes(_metadata).length >= 40 && bytes(_metadata).length <= 100,
            InvalidIPFSCID()
        );

        require(_amount > 0, EditionMustHaveCertificates());
        require(_amount <= maxEditionSize, EditionSizeTooLarge());

        require(_merkleRoot != bytes32(0), EmptyMerkleRoot());

        uint tokenId = artworkTokenization.mintArtworkEdition(
            msg.sender,
            _amount,
            _metadata
        );

        ArtworkEdition storage edition = artworkEditions[tokenId];
        edition.merkleRoot = _merkleRoot;
        initialEditionSize[tokenId] = _amount;

        emit NewArtworkEdition(msg.sender, tokenId);
    }

    /**
     * @dev Allows an artist to update edition metadata ONLY while the artist
     *      still holds every certificate of the original mint.
     * @param _editionId ID of the edition to update
     * @param _newMetadata New IPFS CID pointing to updated edition metadata JSON
     *
     * The invariant is based on the artist's current ERC-1155 balance compared
     * to the initial mint size. Any outgoing transfer — whether through the
     * official `claimCertificate` flow or via a direct ERC-1155 transfer
     * (private sale, marketplace, etc.) — freezes the metadata. This protects
     * buyers regardless of how they acquired their certificate.
     *
     * Requirements:
     * - Caller must be an authorized artist
     * - Artist must be the creator of this edition
     * - Artist must still hold the full initial supply of this edition
     * - New metadata must be a valid IPFS CID
     *
     * Emits an {EditionMetadataUpdated} event
     */
    function updateEditionMetadata(
        uint256 _editionId,
        string memory _newMetadata
    ) external onlyAuthorizedArtist {
        ArtworkEdition storage edition = artworkEditions[_editionId];

        require(edition.merkleRoot != bytes32(0), EditionDoesNotExist());

        address artist = artworkTokenization.tokenArtist(_editionId);
        require(artist == msg.sender, NotYourEdition());

        // The artist must still hold every certificate of the original mint.
        // This invariant protects buyers regardless of how a certificate
        // leaves the artist's wallet (claim, direct ERC-1155 transfer, sale
        // on a secondary marketplace, etc.).
        require(
            artworkTokenization.balanceOf(artist, _editionId) == initialEditionSize[_editionId],
            MetadataLocked()
        );

        require(
            bytes(_newMetadata).length >= 40 && bytes(_newMetadata).length <= 100,
            InvalidIPFSCID()
        );

        artworkTokenization.updateTokenMetadata(_editionId, _newMetadata);

        emit EditionMetadataUpdated(msg.sender, _editionId, _newMetadata);
    }

    /**
     * @dev Disables an edition, preventing any further certificate claims
     * @param _editionId ID of the edition to disable
     *
     * Use this for content moderation (inappropriate artwork) or as the first step
     * in QR code compromise recovery. Already-claimed tokens are unaffected.
     *
     * Requirements:
     * - Caller must be an admin
     * - Edition must exist
     * - Edition must not already be disabled
     *
     * Emits an {EditionDisabled} event
     */
    function disableEdition(uint256 _editionId) external onlyAdmin {
        ArtworkEdition storage edition = artworkEditions[_editionId];
        require(edition.merkleRoot != bytes32(0), EditionDoesNotExist());
        require(!edition.disabled, EditionAlreadyDisabled());
        edition.disabled = true;
        emit EditionDisabled(_editionId, msg.sender);
    }

    /**
     * @dev Replaces the Merkle root of a disabled edition with a fresh one and re-enables it
     * @param _editionId ID of the edition to recover
     * @param _newMerkleRoot New Merkle root built from fresh secret keys for unclaimed certificates
     *
     * Use this after a QR code compromise: disable the edition first, generate new secret keys
     * only for unclaimed certificates, build a new Merkle tree, then call this function.
     * The old compromised keys become invalid immediately (they won't verify against the new root).
     *
     * Requirements:
     * - Caller must be an admin
     * - Edition must exist
     * - New Merkle root must not be empty
     *
     * Emits an {EditionMerkleRootReplaced} event
     */
    function replaceEditionMerkleRoot(uint256 _editionId, bytes32 _newMerkleRoot) external onlyAdmin {
        ArtworkEdition storage edition = artworkEditions[_editionId];
        require(edition.merkleRoot != bytes32(0), EditionDoesNotExist());
        require(edition.disabled, EditionNotDisabled());
        require(_newMerkleRoot != bytes32(0), EmptyMerkleRoot());
        edition.merkleRoot = _newMerkleRoot;
        edition.disabled = false;
        emit EditionMerkleRootReplaced(_editionId, _newMerkleRoot);
    }

    // ============ COLLECTOR FUNCTIONS ============

    /**
     * @dev Allows a collector to claim an artwork certificate using a secret key and Merkle proof
     * @param _editionId ID of the edition to claim from
     * @param _secretKey Secret key from the QR code
     * @param _merkleProof Array of hashes proving the key belongs to the Merkle Tree
     *
     * The function performs security checks in this order:
     * 1. Verifies the edition exists
     * 2. Verifies certificates are still available (balanceOf > 0)
     * 3. Verifies the secret key hasn't been used before
     * 4. Verifies the Merkle proof is valid
     * 5. Transfers the certificate (reverts everything if this fails)
     * 6. Locks metadata (only after successful transfer)
     * 7. Emits event (only after all state changes succeed)
     *
     * After a successful claim, the edition metadata becomes permanently locked.
     *
     * Requirements:
     * - Edition must exist
     * - Edition must have certificates remaining
     * - Secret key must not have been claimed before
     * - Merkle proof must be valid
     * - Artist must have approved ArtworkRegistry via setApprovalForAll
     *
     * Emits a {CertificateClaimed} event
     */
    function claimCertificate(
        uint256 _editionId,
        string memory _secretKey,
        bytes32[] memory _merkleProof
    ) external nonReentrant {
        ArtworkEdition storage edition = artworkEditions[_editionId];

        require(edition.merkleRoot != bytes32(0), EditionDoesNotExist());
        require(!edition.disabled, EditionIsDisabled());

        address artist = artworkTokenization.tokenArtist(_editionId);

        uint256 remainingCertificates = artworkTokenization.balanceOf(
            artist,
            _editionId
        );
        require(remainingCertificates > 0, NoCertificateLeft());

        bytes32 leaf = keccak256(abi.encodePacked(keccak256(abi.encodePacked(_secretKey))));
        require(!claimedKeys[_editionId][leaf], KeyAlreadyClaimed());

        require(
            MerkleProof.verify(_merkleProof, edition.merkleRoot, leaf),
            InvalidMerkleProof()
        );

        claimedKeys[_editionId][leaf] = true;

        artworkTokenization.safeTransferFrom(
            artist,
            msg.sender,
            _editionId,
            1,
            ""
        );

        emit CertificateClaimed(msg.sender, _editionId);
    }

    /**
     * @dev Allows a certificate holder to add a review for an edition
     * @param _editionId ID of the edition to review
     * @param _rating Numerical rating (0-5)
     * @param _metadata IPFS CID pointing to review text in JSON format
     *
     * Requirements:
     * - Caller must own at least one certificate of the specified edition
     * - Rating must be between 0 and 5
     * - User must not have reached the review limit for this edition
     * - Metadata must be a valid IPFS CID
     *
     * Emits a {NewReview} event
     */
    function addReview(
        uint _editionId,
        uint8 _rating,
        string memory _metadata
    ) external {
        require(artworkEditions[_editionId].merkleRoot != bytes32(0), EditionDoesNotExist());
        require(!artworkEditions[_editionId].disabled, EditionIsDisabled());

        require(
            artworkTokenization.balanceOf(msg.sender, _editionId) > 0,
            NotAllowedToReview()
        );

        require(_rating <= 5, RatingOutOfRange());

        require(
            reviewCount[_editionId][msg.sender] < maxReviewsPerUserAndEdition,
            ReviewLimitReached()
        );

        require(
            bytes(_metadata).length >= 40 && bytes(_metadata).length <= 100,
            InvalidIPFSCID()
        );

        editionReviews[_editionId].push(
            Review(msg.sender, _rating,  _editionId, _metadata)
        );

        reviewCount[_editionId][msg.sender]++;

        emit NewReview(msg.sender, _editionId, _rating);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Returns the information of an artist
     * @param _address Address of the artist to query
     * @return Artist struct containing all artist information
     */
    function getArtist(address _address) external view returns (Artist memory) {
        return artists[_address];
    }

    /**
     * @dev Returns the information of an artwork edition
     * @param _id ID of the edition to query
     * @return metadata IPFS CID from ArtworkTokenization
     * @return merkleRoot Root hash of the Merkle Tree
     * @return disabled Whether the edition has been disabled by an admin
     */
    function getArtworkEdition(uint _id) external view returns (
        string memory metadata,
        bytes32 merkleRoot,
        bool disabled
    ) {
        ArtworkEdition storage edition = artworkEditions[_id];
        return (
            artworkTokenization.uri(_id),
            edition.merkleRoot,
            edition.disabled
        );
    }

    /**
     * @dev Returns all reviews for a specific edition (paginated)
     * @param _editionId ID of the edition
     * @param startIndex Starting index for pagination
     * @param limit Maximum number of reviews to return (capped at maxReviewsQuery)
     * @return Array of reviews
     *
     * @notice Returns empty array if startIndex is beyond total reviews
     */
    function getEditionReviews(
        uint _editionId,
        uint startIndex,
        uint limit
    ) external view returns (Review[] memory) {
        require(limit <= maxReviewsQuery, QueryLimitTooHigh());

        uint total = editionReviews[_editionId].length;

        if (startIndex >= total) {
            return new Review[](0);
        }

        uint end = startIndex + limit > total ? total : startIndex + limit;
        uint resultLength = end - startIndex;

        Review[] memory result = new Review[](resultLength);
        for (uint i = 0; i < resultLength; i++) {
            result[i] = editionReviews[_editionId][startIndex + i];
        }

        return result;
    }

    /**
     * @dev Returns the total number of reviews for an edition
     * @param _editionId ID of the edition
     * @return Total number of reviews
     */
    function getEditionReviewsCount(
        uint _editionId
    ) external view returns (uint) {
        return editionReviews[_editionId].length;
    }

    /**
     * @dev Checks if a secret key has already been claimed for an edition
     * @param _editionId ID of the edition
     * @param _secretKey Secret key to check
     * @return True if the key has been claimed, false otherwise
     */
    function isKeyClaimed(
        uint256 _editionId,
        string memory _secretKey
    ) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(keccak256(abi.encodePacked(_secretKey))));
        return claimedKeys[_editionId][leaf];
    }

    /**
     * @dev Checks if an address has admin privileges
     * @param _address Address to check
     * @return True if the address is an admin, false otherwise
     */
    function isAdmin(address _address) external view returns (bool) {
        return admins[_address];
    }

    /**
     * @dev Checks whether an edition's metadata is locked.
     *      The edition is considered locked as soon as the artist no longer
     *      holds the full initial supply — through any channel (claim, direct
     *      ERC-1155 transfer, marketplace sale).
     * @param _editionId ID of the edition to check
     * @return True if at least one certificate has left the artist's wallet,
     *         false otherwise (including for non-existent editions).
     */
    function isEditionLocked(uint256 _editionId) external view returns (bool) {
        address artist = artworkTokenization.tokenArtist(_editionId);
        if (artist == address(0)) return false;
        return artworkTokenization.balanceOf(artist, _editionId) < initialEditionSize[_editionId];
    }

    /**
     * @dev Checks if an artist has approved this contract to transfer their certificates
     * @param _artist Address of the artist to check
     * @return True if the artist has approved this contract, false otherwise
     *
     * @notice Artists must call setApprovalForAll(ArtworkRegistryAddress, true)
     * on the ArtworkTokenization contract before collectors can claim their certificates.
     * This function allows checking the approval status.
     *
     * Example usage:
     * - Frontend can warn artists if they haven't approved yet
     * - Artists can verify their approval status before creating editions
     */
    function isArtistApproved(address _artist) external view returns (bool) {
        return artworkTokenization.isApprovedForAll(_artist, address(this));
    }
}
