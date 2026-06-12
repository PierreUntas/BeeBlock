// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArtworkTokenization
 * @dev ERC1155 token contract for artwork edition tokenization
 * @notice This contract manages the creation and tracking of artwork edition certificates
 *
 * Each token ID represents a unique artwork edition from an artist. The contract
 * uses ERC1155 standard to allow multiple certificates of the same edition to be minted.
 * Only the owner (ArtworkRegistry) can mint new editions.
*
 * IMPORTANT FOR ARTISTS:
 * Artists must call setApprovalForAll(ArtworkRegistryAddress, true)
 * to allow collectors to claim their certificates. Without this approval,
 * claims will fail with: ERC1155MissingApprovalForAll(operator, owner)
 */
contract ArtworkTokenization is ERC1155, Ownable {

    /// @dev Counter for generating unique token IDs
    uint256 private _currentTokenId;

    /// @dev Mapping from token ID to its metadata URI
    mapping(uint256 => string) private _tokenURIs;

    /// @dev Mapping from token ID to the artist's address
    mapping(uint256 => address) public tokenArtist;

    /**
     * @dev Emitted when a new artwork edition is minted
     * @param artist Address of the artist who owns the edition
     * @param tokenId Unique identifier for the artwork edition
     * @param amount Number of certificates minted for this edition
     */
    event ArtworkEditionMinted(address indexed artist, uint256 indexed tokenId, uint256 amount);

    /**
     * @dev Emitted when the metadata for a token ID is updated
     * @param tokenId The token ID whose metadata was updated
     * @param newMetadata The new metadata associated with the token ID
     */
    event TokenMetadataUpdated(uint256 indexed tokenId, string newMetadata);

    /**
     * @dev Constructor that sets the base URI and initializes Ownable
     * @param uriIpfs Base URI for token metadata (typically an IPFS gateway)
     */
    constructor(string memory uriIpfs) ERC1155(uriIpfs) Ownable(msg.sender) {}

    /// @dev Thrown when a string parameter length is invalid
    error InvalidStringLength();

    /// @dev Thrown when an IPFS CID format is invalid
    error InvalidIPFSCID();

    /// @dev Thrown when trying to mint an edition with zero certificates
    error InvalidAmount();

    /// @dev Thrown when trying to mint an edition for the zero address
    error InvalidArtistAddress();

    /**
     * @dev Mints a new artwork edition and assigns it to an artist
     * @param _artist Address that will receive and own the minted certificates
     * @param _amount Number of certificates to mint for this edition
     * @param _uri Metadata URI specific to this edition
     * @return newTokenId The ID of the newly created token
     *
     * Requirement: Caller must be the contract owner (ArtworkRegistry)
     */
    function mintArtworkEdition(address _artist, uint _amount, string memory _uri) external onlyOwner returns (uint256) {
        if (_artist == address(0)) revert InvalidArtistAddress();

        if (_amount == 0) revert InvalidAmount();

        if (bytes(_uri).length < 40 || bytes(_uri).length > 100) revert InvalidIPFSCID();

        _currentTokenId++;
        uint256 newTokenId = _currentTokenId;

        tokenArtist[newTokenId] = _artist;
        _tokenURIs[newTokenId] = _uri;
        _mint(_artist, newTokenId, _amount, "");

        emit ArtworkEditionMinted(_artist, newTokenId, _amount);
        // Standard EIP-1155 URI event so that external marketplaces and
        // wallets (OpenSea, Rarible, Zerion, Rainbow, etc.) automatically
        // index the new edition's metadata.
        emit URI(_uri, newTokenId);
        return newTokenId;
    }

    /**
     * @dev Returns the metadata URI for a given token ID
     * @param tokenId The token ID to query
     * @return The URI string containing the token's metadata
     *
     * Overrides the base ERC1155 uri function to return edition-specific metadata
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

        /**
        * @dev Updates the metadata URI for a specific token ID
        * @param _tokenId The token ID whose URI is to be updated
        * @param _newMetadata The new metadata URI to associate with the token ID
        */
    function updateTokenMetadata(uint256 _tokenId, string memory _newMetadata) external onlyOwner {
        if (bytes(_newMetadata).length < 40 || bytes(_newMetadata).length > 100) revert InvalidIPFSCID();
        _tokenURIs[_tokenId] = _newMetadata;
        emit TokenMetadataUpdated(_tokenId, _newMetadata);
        // Standard EIP-1155 URI event for external indexers and marketplaces
        // to refresh their cached metadata.
        emit URI(_newMetadata, _tokenId);
    }
}