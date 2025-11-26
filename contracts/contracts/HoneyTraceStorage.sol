// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";


interface IHoneyTokenization {
    function mintHoneyBatch(address producer, uint256 amount, string memory uri) external returns (uint256);

    function balanceOf(address account, uint256 id) external view returns (uint256);

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) external;

    function tokenProducer(uint256 tokenId) external view returns (address);
}

contract HoneyTraceStorage is Ownable {
    struct Producer {
        address id;
        bool authorized;
        string name;
        string location;
        string companyRegisterNumber;
        string metadata;
    }

    struct HoneyBatch {
        uint id;
        string honeyType;
        string metadata;
        bytes32 merkleRoot;
        uint claimedCount;
    }

    struct Comment {
        address consumer;
        uint honeyBatchId;
        uint8 rating;
        string metadata;
    }

    mapping(address => Producer) producers;
    mapping(uint => HoneyBatch) honeyBatches;
    mapping(uint => Comment[]) honeyBatchesComments;
    mapping(address => bool) admins;

    IHoneyTokenization public honeyTokenization;

    mapping(uint256 => mapping(bytes32 => bool)) private claimedKeys; // tokenId => keyHash => claimed

    event NewAdmin(address indexed newAdmin);
    event AuthorizationProducer(address indexed producer, bool isAuthorized);
    event NewProducer(address indexed producer);
    event NewHoneyBatch(address indexed producer, uint indexed honeyBatchId);
    event HoneyTokenClaimed(address indexed consumer, uint indexed honeyBatchId, bytes32 keyHash);
    event NewComment(address indexed consumer, uint indexed honeyBatchId, uint8 rating);

    error onlyAdminAuthorized();
    error authorizationAlreadyApply();
    error producerNotAuthorized();
    error notAllowedToComment();
    error invalidMerkleProof();
    error keyAlreadyClaimed();
    error noTokenLeft();

    function addAdmin(address _newAdmin) external onlyOwner {
        admins[_newAdmin] = true;
        emit NewAdmin(_newAdmin);
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], onlyAdminAuthorized());
        _;
    }

    modifier onlyAuthorizedProducer() {
        require(producers[msg.sender].authorized, producerNotAuthorized());
        _;
    }

    constructor(address _honeyTokenizationAddress) Ownable(msg.sender) {
        honeyTokenization = IHoneyTokenization(_honeyTokenizationAddress);
        admins[msg.sender] = true;
    }

    function authorizeProducer(address _producer, bool _isAuthorized) external onlyAdmin {
        require(producers[_producer].authorized != _isAuthorized, authorizationAlreadyApply());
        producers[_producer].authorized = _isAuthorized;
        emit AuthorizationProducer(_producer, _isAuthorized);
    }

    function addProducer(string memory _name, string memory _location, string memory _companyRegisterNumber, string memory _metadata) external onlyAuthorizedProducer {
        Producer storage producer = producers[msg.sender];
        producer.name = _name;
        producer.location = _location;
        producer.companyRegisterNumber = _companyRegisterNumber;
        producer.metadata = _metadata = _metadata;

        emit NewProducer(msg.sender);
    }

    function addHoneyBatch(string memory _honeyType, string memory _metadata, uint256 _amount, bytes32 _merkleRoot) external onlyAuthorizedProducer {
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

    function claimHoneyToken(uint256 _honeyBatchId, string memory _secretKey, bytes32[] memory _merkleProof) external {
        HoneyBatch storage batch = honeyBatches[_honeyBatchId];

        address producer = honeyTokenization.tokenProducer(_honeyBatchId);

        uint256 remainingTokens = honeyTokenization.balanceOf(producer, _honeyBatchId);

        require(remainingTokens > 0, noTokenLeft());

        bytes32 leaf = keccak256(abi.encodePacked(_secretKey));

        require(!claimedKeys[_honeyBatchId][leaf], keyAlreadyClaimed());

        require(MerkleProof.verify(_merkleProof, batch.merkleRoot, leaf), invalidMerkleProof());

        claimedKeys[_honeyBatchId][leaf] = true;
        batch.claimedCount++;

        honeyTokenization.safeTransferFrom(producer, msg.sender, _honeyBatchId, 1, "");

        emit HoneyTokenClaimed(msg.sender, _honeyBatchId, leaf);
    }


    function addComment(uint _honeyBatchId, uint8 _rating, string memory _metadata) external {
        require(honeyTokenization.balanceOf(msg.sender, _honeyBatchId) > 0, notAllowedToComment());

        honeyBatchesComments[_honeyBatchId].push(
            Comment(msg.sender, _honeyBatchId, _rating, _metadata)
        );

        emit NewComment(msg.sender, _honeyBatchId, _rating);
    }

    function getProducer(address _address) external view returns (Producer memory) {
        return producers[_address];
    }

    function getHoneyBatch(uint _id) external view returns (HoneyBatch memory) {
        return honeyBatches[_id];
    }

    function getHoneyBatchComments(uint _honeyBatchId) external view returns (Comment[] memory) {
        return honeyBatchesComments[_honeyBatchId];
    }

    function isKeyClaimed(uint256 _honeyBatchId, string memory _secretKey) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_secretKey));
        return claimedKeys[_honeyBatchId][leaf];
    }
}
