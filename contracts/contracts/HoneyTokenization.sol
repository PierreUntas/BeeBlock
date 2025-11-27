// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HoneyTokenization is ERC1155, Ownable {

    uint256 private _currentTokenId;

    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => address) public tokenProducer;

    event HoneyBatchMinted(address indexed producer, uint256 indexed tokenId, uint256 amount);

    constructor(string memory uriIpfs) ERC1155(uriIpfs) Ownable(msg.sender) {}

    function mintHoneyBatch(address _producer, uint _amount, string memory _uri) external onlyOwner returns (uint256) {
        _currentTokenId++;
        uint256 newTokenId = _currentTokenId;

        tokenProducer[newTokenId] = _producer;
        _mint(_producer, newTokenId, _amount, "");
        _tokenURIs[newTokenId] = _uri;

        emit HoneyBatchMinted(_producer, newTokenId, _amount);
        return newTokenId;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

    function transferOwnershipTo(address newOwner) external onlyOwner {
    transferOwnership(newOwner);
}

    // Note: Producers must call setApprovalForAll(HoneyTraceStorageAddress, true)
    // to allow the HoneyTraceStorage contract to transfer their tokens during the claim
}