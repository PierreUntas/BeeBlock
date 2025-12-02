// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HoneyTokenization
 * @dev ERC1155 token contract for honey batch tokenization
 * @notice This contract manages the creation and tracking of honey batch tokens
 *
 * Each token ID represents a unique honey batch from a producer. The contract
 * uses ERC1155 standard to allow multiple tokens of the same batch to be minted.
 * Only the owner (HoneyTraceStorage) can mint new batches.
 */
contract HoneyTokenization is ERC1155, Ownable {

    /// @dev Counter for generating unique token IDs
    uint256 private _currentTokenId;

    /// @dev Mapping from token ID to its metadata URI
    mapping(uint256 => string) private _tokenURIs;

    /// @dev Mapping from token ID to the producer's address
    mapping(uint256 => address) public tokenProducer;

    /**
     * @dev Emitted when a new honey batch is minted
     * @param producer Address of the producer who owns the batch
     * @param tokenId Unique identifier for the honey batch
     * @param amount Number of tokens minted for this batch
     */
    event HoneyBatchMinted(address indexed producer, uint256 indexed tokenId, uint256 amount);

    /**
     * @dev Constructor that sets the base URI and initializes Ownable
     * @param uriIpfs Base URI for token metadata (typically an IPFS gateway)
     */
    constructor(string memory uriIpfs) ERC1155(uriIpfs) Ownable(msg.sender) {}

    /// @dev Thrown when a string parameter length is invalid
    error InvalidStringLength();

    /**
     * @dev Mints a new honey batch and assigns it to a producer
     * @param _producer Address that will receive and own the minted tokens
     * @param _amount Number of tokens to mint for this batch
     * @param _uri Metadata URI specific to this batch
     * @return newTokenId The ID of the newly created token
     *
     * Requirement: Caller must be the contract owner (HoneyTraceStorage)
     */
    function mintHoneyBatch(address _producer, uint _amount, string memory _uri) external onlyOwner returns (uint256) {
        if (bytes(_uri).length < 10 || bytes(_uri).length > 256) revert InvalidStringLength();

        _currentTokenId++;
        uint256 newTokenId = _currentTokenId;

        tokenProducer[newTokenId] = _producer;
        _tokenURIs[newTokenId] = _uri;
        _mint(_producer, newTokenId, _amount, "");

        emit HoneyBatchMinted(_producer, newTokenId, _amount);
        return newTokenId;
    }

    /**
     * @dev Returns the metadata URI for a given token ID
     * @param tokenId The token ID to query
     * @return The URI string containing the token's metadata
     *
     * Overrides the base ERC1155 uri function to return batch-specific metadata
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

    /**
      * @notice Producers must call setApprovalForAll(HoneyTraceStorageAddress, true)
     * @dev This approval allows the HoneyTraceStorage contract to transfer tokens
     * from the producer to consumers during the claim process
     *
     * Without this approval, the claim function will revert with:
     * "ERC1155: caller is not token owner or approved"
     *
     * Example usage:
     * honeyTokenization.setApprovalForAll(honeyTraceStorageAddress, true);
     */
}