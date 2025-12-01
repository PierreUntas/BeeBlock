// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title IHoneyTokenization
 * @dev Interface for the HoneyTokenization contract
 */
interface IHoneyTokenization {
    function mintHoneyBatch(address producer, uint256 amount, string memory uri) external returns (uint256);
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) external;
    function tokenProducer(uint256 tokenId) external view returns (address);
}

/**
 * @title HoneyTraceStorage
 * @dev Main contract for honey traceability system using Merkle Tree for secure token distribution
 * @notice This contract manages producers, honey batches, and token claims using cryptographic proofs
 *
 * The contract implements a three-tier authorization system:
 * 1. Owner can add admins
 * 2. Admins can authorize producers
 * 3. Authorized producers can create honey batches
 *
 * Token distribution uses Merkle Tree proofs for gas-efficient and secure claiming.
 */
contract HoneyTraceStorage is Ownable {

    // ============ STRUCTS ============

    /**
     * @dev Structure representing a honey producer
     * @param id Ethereum address of the producer
     * @param authorized Whether the producer is authorized to create batches
     * @param name Business name of the producer
     * @param location Physical location of production
     * @param companyRegisterNumber Official business registration number
     * @param metadata Additional information in JSON format (certifications, etc.)
     */
    struct Producer {
        address id;
        bool authorized;
        string name;
        string location;
        string companyRegisterNumber;
        string metadata;
    }

    /**
     * @dev Structure representing a honey batch
     * @param id Unique identifier for the batch (same as ERC1155 token ID)
     * @param honeyType Type of honey (e.g., "Acacia", "Lavender")
     * @param metadata Batch-specific information (origin, harvest date, etc.)
     * @param merkleRoot Root hash of the Merkle Tree containing all secret keys for this batch
     */
    struct HoneyBatch {
        uint id;
        string honeyType;
        string metadata;
        bytes32 merkleRoot;
    }

    /**
     * @dev Structure representing a consumer comment/review
     * @param consumer Address of the consumer who left the comment
     * @param honeyBatchId ID of the batch being reviewed
     * @param rating Numerical rating (0-5)
     * @param metadata Comment text and additional information in JSON format
     */
    struct Comment {
        address consumer;
        uint honeyBatchId;
        uint8 rating;
        string metadata;
    }

    // ============ STATE VARIABLES ============

    /// @dev Mapping from producer address to their information
    mapping(address => Producer) producers;

    /// @dev Mapping from batch ID to batch information
    mapping(uint => HoneyBatch) honeyBatches;

    /// @dev Mapping from batch ID to array of comments
    mapping(uint => Comment[]) honeyBatchesComments;

    /// @dev Mapping to track admin addresses
    mapping(address => bool) public admins;

    /// @dev Reference to the HoneyTokenization contract
    IHoneyTokenization public honeyTokenization;

    /**
     * @dev Nested mapping to track claimed keys
     * First key: batch ID
     * Second key: hash of the secret key
     * Value: whether this key has been claimed
     *
     * This prevents double-claiming of the same QR code
     */
    mapping(uint256 => mapping(bytes32 => bool)) private claimedKeys;

    // ============ EVENTS ============

    /**
     * @dev Emitted when a new admin is added
     * @param newAdmin Address of the newly added admin
     */
    event NewAdmin(address indexed newAdmin);

    /**
     * @dev Emitted when a producer's authorization status changes
     * @param producer Address of the producer
     * @param isAuthorized New authorization status
     */
    event AuthorizationProducer(address indexed producer, bool isAuthorized);

    /**
     * @dev Emitted when a producer registers their information
     * @param producer Address of the producer
     */
    event NewProducer(address indexed producer);

    /**
     * @dev Emitted when a new honey batch is created
     * @param producer Address of the producer who created the batch
     * @param honeyBatchId Unique identifier for the batch
     */
    event NewHoneyBatch(address indexed producer, uint indexed honeyBatchId);

    /**
     * @dev Emitted when a consumer successfully claims a honey token
     * @param consumer Address of the consumer
     * @param honeyBatchId ID of the claimed batch
     * @param keyHash Hash of the secret key used for claiming
     */
    event HoneyTokenClaimed(address indexed consumer, uint indexed honeyBatchId, bytes32 keyHash);

    /**
     * @dev Emitted when a consumer adds a comment to a batch
     * @param consumer Address of the consumer
     * @param honeyBatchId ID of the batch being reviewed
     * @param rating Numerical rating given
     */
    event NewComment(address indexed consumer, uint indexed honeyBatchId, uint8 rating);

    // ============ ERRORS ============

    /// @dev Thrown when a non-admin tries to perform an admin-only action
    error onlyAdminAuthorized();

    /// @dev Thrown when trying to set an authorization status that's already set
    error authorizationAlreadyApply();

    /// @dev Thrown when an unauthorized producer tries to perform a producer action
    error producerNotAuthorized();

    /// @dev Thrown when a non-token-holder tries to comment
    error notAllowedToComment();

    /// @dev Thrown when the Merkle proof verification fails
    error invalidMerkleProof();

    /// @dev Thrown when trying to claim with an already used secret key
    error keyAlreadyClaimed();

    /// @dev Thrown when trying to claim but no tokens are left
    error noTokenLeft();

    // ============ MODIFIERS ============

    /**
     * @dev Modifier to restrict function access to admins only
     */
    modifier onlyAdmin() {
        require(admins[msg.sender], onlyAdminAuthorized());
        _;
    }

    /**
     * @dev Modifier to restrict function access to authorized producers only
     */
    modifier onlyAuthorizedProducer() {
        require(producers[msg.sender].authorized, producerNotAuthorized());
        _;
    }

    // ============ CONSTRUCTOR ============

    /**
     * @dev Initializes the contract with the HoneyTokenization address
     * @param _honeyTokenizationAddress Address of the deployed HoneyTokenization contract
     *
     * The deployer is automatically set as the owner and first admin
     */
    constructor(address _honeyTokenizationAddress) Ownable(msg.sender) {
        honeyTokenization = IHoneyTokenization(_honeyTokenizationAddress);
        admins[msg.sender] = true;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Adds a new admin to the system
     * @param _newAdmin Address to be granted admin privileges
     *
     * Requirements:
     * - Caller must be the contract owner
     *
     * Emits a {NewAdmin} event
     */
    function addAdmin(address _newAdmin) external onlyOwner {
        admins[_newAdmin] = true;
        emit NewAdmin(_newAdmin);
    }

    /**
     * @dev Authorizes or revokes authorization for a producer
     * @param _producer Address of the producer
     * @param _isAuthorized True to authorize, false to revoke
     *
     * Requirements:
     * - Caller must be an admin
     * - The authorization status must be different from current status
     *
     * Emits an {AuthorizationProducer} event
     */
    function authorizeProducer(address _producer, bool _isAuthorized) external onlyAdmin {
        require(producers[_producer].authorized != _isAuthorized, authorizationAlreadyApply());
        producers[_producer].authorized = _isAuthorized;
        emit AuthorizationProducer(_producer, _isAuthorized);
    }

    // ============ PRODUCER FUNCTIONS ============

    /**
     * @dev Allows an authorized producer to register or update their information
     * @param _name Business name
     * @param _location Physical location
     * @param _companyRegisterNumber Official registration number
     * @param _metadata Additional information in JSON format
     *
     * Requirements:
     * - Caller must be an authorized producer
     *
     * Emits a {NewProducer} event
     */
    function addProducer(
        string memory _name,
        string memory _location,
        string memory _companyRegisterNumber,
        string memory _metadata
    ) external onlyAuthorizedProducer {
        Producer storage producer = producers[msg.sender];
        producer.name = _name;
        producer.location = _location;
        producer.companyRegisterNumber = _companyRegisterNumber;
        producer.metadata = _metadata;

        emit NewProducer(msg.sender);
    }

    /**
     * @dev Creates a new honey batch with Merkle Tree root for secure distribution
     * @param _honeyType Type of honey (e.g., "Acacia", "Lavender")
     * @param _metadata Batch metadata (origin, harvest date, etc.)
     * @param _amount Number of tokens to mint for this batch
     * @param _merkleRoot Root hash of the Merkle Tree containing all secret keys
     *
     * The Merkle Tree allows gas-efficient verification of secret keys during claims.
     * Each token in the batch corresponds to one secret key in the tree.
     *
     * Requirements:
     * - Caller must be an authorized producer
     * - Producer must have called setApprovalForAll on HoneyTokenization
     *
     * Emits a {NewHoneyBatch} event
     */
    function addHoneyBatch(
        string memory _honeyType,
        string memory _metadata,
        uint256 _amount,
        bytes32 _merkleRoot
    ) external onlyAuthorizedProducer {
        uint tokenId = honeyTokenization.mintHoneyBatch(
            msg.sender,
            _amount,
            _metadata
        );

        HoneyBatch storage honeyBatch = honeyBatches[tokenId];
        honeyBatch.id = tokenId;
        honeyBatch.honeyType = _honeyType;
        honeyBatch.metadata = _metadata;
        honeyBatch.merkleRoot = _merkleRoot;

        emit NewHoneyBatch(msg.sender, tokenId);
    }

    // ============ CONSUMER FUNCTIONS ============

    /**
     * @dev Allows a consumer to claim a honey token using a secret key and Merkle proof
     * @param _honeyBatchId ID of the batch to claim from
     * @param _secretKey Secret key from the QR code
     * @param _merkleProof Array of hashes proving the key belongs to the Merkle Tree
     *
     * The function performs three security checks:
     * 1. Verifies tokens are still available (balanceOf > 0)
     * 2. Verifies the secret key hasn't been used before
     * 3. Verifies the Merkle proof is valid
     *
     * Requirements:
     * - Batch must have tokens remaining
     * - Secret key must not have been claimed before
     * - Merkle proof must be valid
     * - Producer must have approved HoneyTraceStorage via setApprovalForAll
     *
     * Emits a {HoneyTokenClaimed} event
     */
    function claimHoneyToken(
        uint256 _honeyBatchId,
        string memory _secretKey,
        bytes32[] memory _merkleProof
    ) external {
        HoneyBatch storage batch = honeyBatches[_honeyBatchId];

        address producer = honeyTokenization.tokenProducer(_honeyBatchId);

        // Check 1: Verify tokens are available
        uint256 remainingTokens = honeyTokenization.balanceOf(producer, _honeyBatchId);
        require(remainingTokens > 0, noTokenLeft());

        // Check 2: Verify key hasn't been used
        bytes32 leaf = keccak256(abi.encodePacked(_secretKey));
        require(!claimedKeys[_honeyBatchId][leaf], keyAlreadyClaimed());

        // Check 3: Verify Merkle proof
        require(MerkleProof.verify(_merkleProof, batch.merkleRoot, leaf), invalidMerkleProof());

        // Mark key as claimed
        claimedKeys[_honeyBatchId][leaf] = true;

        // Transfer token from producer to consumer
        honeyTokenization.safeTransferFrom(producer, msg.sender, _honeyBatchId, 1, "");

        emit HoneyTokenClaimed(msg.sender, _honeyBatchId, leaf);
    }

    /**
     * @dev Allows a token holder to add a comment/review for a batch
     * @param _honeyBatchId ID of the batch to comment on
     * @param _rating Numerical rating (0-5)
     * @param _metadata Comment text and additional info in JSON format
     *
     * Requirements:
     * - Caller must own at least one token of the specified batch
     *
     * Emits a {NewComment} event
     */
    function addComment(
        uint _honeyBatchId,
        uint8 _rating,
        string memory _metadata
    ) external {
        require(honeyTokenization.balanceOf(msg.sender, _honeyBatchId) > 0, notAllowedToComment());

        honeyBatchesComments[_honeyBatchId].push(
            Comment(msg.sender, _honeyBatchId, _rating, _metadata)
        );

        emit NewComment(msg.sender, _honeyBatchId, _rating);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Returns the information of a producer
     * @param _address Address of the producer to query
     * @return Producer struct containing all producer information
     */
    function getProducer(address _address) external view returns (Producer memory) {
        return producers[_address];
    }

    /**
     * @dev Returns the information of a honey batch
     * @param _id ID of the batch to query
     * @return HoneyBatch struct containing all batch information
     */
    function getHoneyBatch(uint _id) external view returns (HoneyBatch memory) {
        return honeyBatches[_id];
    }

    /**
     * @dev Returns all comments for a specific batch
     * @param _honeyBatchId ID of the batch
     * @return Array of Comment structs
     */
    function getHoneyBatchComments(uint _honeyBatchId) external view returns (Comment[] memory) {
        return honeyBatchesComments[_honeyBatchId];
    }

    /**
     * @dev Checks if a secret key has already been claimed for a batch
     * @param _honeyBatchId ID of the batch
     * @param _secretKey Secret key to check
     * @return True if the key has been claimed, false otherwise
     */
    function isKeyClaimed(uint256 _honeyBatchId, string memory _secretKey) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_secretKey));
        return claimedKeys[_honeyBatchId][leaf];
    }

    /**
     * @dev Checks if an address has admin privileges
     * @param _address Address to check
     * @return True if the address is an admin, false otherwise
     */
    function isAdmin(address _address) external view returns (bool) {
        return admins[_address];
    }
}