// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IHoneyTokenization {
    function mintHoneyBatch(address producer, uint256 amount, string memory uri) external returns (uint256);

    function balanceOf(address account, uint256 id) external view returns (uint256);
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

    event NewAdmin(address indexed newAdmin);
    event AuthorizationProducer(address indexed producer, bool isAuthorized);
    event NewProducer(address indexed producer);
    event NewHoneyBatch(address indexed producer, uint indexed honeyBatchId);
    event NewComment(address indexed consumer, uint indexed honeyBatchId, uint8 rating);

    error onlyAdminAuthorized();
    error authorizationAlreadyApply();
    error producerNotAuthorized();
    error notAllowedToComment();

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

    function addHoneyBatch(string memory _honeyType, string memory _metadata) external onlyAuthorizedProducer {
        uint tokenId = honeyTokenization.mintHoneyBatch(
            msg.sender,
            100,
            _metadata
        );

        HoneyBatch storage honeyBatch = honeyBatches[tokenId];
        honeyBatch.id = tokenId;
        honeyBatch.honeyType = _honeyType;
        honeyBatch.metadata = _metadata;

        emit NewHoneyBatch(msg.sender, tokenId);
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

    function getHoneyBatchComments(uint _honeybatchId) external view returns (Comment[] memory) {
        return honeyBatchesComments[_honeybatchId];
    }
}
