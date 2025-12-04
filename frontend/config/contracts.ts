import { parseAbiItem } from 'viem';

// Adresses des contrats
export const HONEY_TRACE_STORAGE_ADDRESS = process.env.NEXT_PUBLIC_HONEY_TRACE_STORAGE_ADDRESS as `0x${string}`;
export const HONEY_TOKENIZATION_ADDRESS = process.env.NEXT_PUBLIC_HONEY_TOKENIZATION_ADDRESS as `0x${string}`;

// ABI HoneyTraceStorage
export const HONEY_TRACE_STORAGE_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_honeyTokenizationAddress",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "InvalidStringLength",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ReentrancyGuardReentrantCall",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "authorizationAlreadyApply",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "batchSizeTooLarge",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "commentLimitReached",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "invalidMerkleProof",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "keyAlreadyClaimed",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "noTokenLeft",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "notAllowedToComment",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "onlyAdminAuthorized",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "producerNotAuthorized",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ratingMustBeBetween0And5",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "admin",
                "type": "address"
            }
        ],
        "name": "AdminRemoved",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "producer",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "bool",
                "name": "isAuthorized",
                "type": "bool"
            }
        ],
        "name": "AuthorizationProducer",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "consumer",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "honeyBatchId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "keyHash",
                "type": "bytes32"
            }
        ],
        "name": "HoneyTokenClaimed",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "newAdmin",
                "type": "address"
            }
        ],
        "name": "NewAdmin",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "consumer",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "honeyBatchId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint8",
                "name": "rating",
                "type": "uint8"
            }
        ],
        "name": "NewComment",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "producer",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "honeyBatchId",
                "type": "uint256"
            }
        ],
        "name": "NewHoneyBatch",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "producer",
                "type": "address"
            }
        ],
        "name": "NewProducer",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "MAX_BATCH_SIZE",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MAX_COMMENTS_PER_USER",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_newAdmin",
                "type": "address"
            }
        ],
        "name": "addAdmin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_honeyBatchId",
                "type": "uint256"
            },
            {
                "internalType": "uint8",
                "name": "_rating",
                "type": "uint8"
            },
            {
                "internalType": "string",
                "name": "_metadata",
                "type": "string"
            }
        ],
        "name": "addComment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_honeyType",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_metadata",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "_amount",
                "type": "uint256"
            },
            {
                "internalType": "bytes32",
                "name": "_merkleRoot",
                "type": "bytes32"
            }
        ],
        "name": "addHoneyBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_name",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_location",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_companyRegisterNumber",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "_metadata",
                "type": "string"
            }
        ],
        "name": "addProducer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "admins",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_producer",
                "type": "address"
            },
            {
                "internalType": "bool",
                "name": "_isAuthorized",
                "type": "bool"
            }
        ],
        "name": "authorizeProducer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_honeyBatchId",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "_secretKey",
                "type": "string"
            },
            {
                "internalType": "bytes32[]",
                "name": "_merkleProof",
                "type": "bytes32[]"
            }
        ],
        "name": "claimHoneyToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "commentCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_id",
                "type": "uint256"
            }
        ],
        "name": "getHoneyBatch",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "uint256",
                        "name": "id",
                        "type": "uint256"
                    },
                    {
                        "internalType": "string",
                        "name": "honeyType",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "metadata",
                        "type": "string"
                    },
                    {
                        "internalType": "bytes32",
                        "name": "merkleRoot",
                        "type": "bytes32"
                    }
                ],
                "internalType": "struct HoneyTraceStorage.HoneyBatch",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_honeyBatchId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "offset",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "limit",
                "type": "uint256"
            }
        ],
        "name": "getHoneyBatchComments",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "consumer",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "honeyBatchId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint8",
                        "name": "rating",
                        "type": "uint8"
                    },
                    {
                        "internalType": "string",
                        "name": "metadata",
                        "type": "string"
                    }
                ],
                "internalType": "struct HoneyTraceStorage.Comment[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_honeyBatchId",
                "type": "uint256"
            }
        ],
        "name": "getHoneyBatchCommentsCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_address",
                "type": "address"
            }
        ],
        "name": "getProducer",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "id",
                        "type": "address"
                    },
                    {
                        "internalType": "bool",
                        "name": "authorized",
                        "type": "bool"
                    },
                    {
                        "internalType": "string",
                        "name": "name",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "location",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "companyRegisterNumber",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "metadata",
                        "type": "string"
                    }
                ],
                "internalType": "struct HoneyTraceStorage.Producer",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "honeyTokenization",
        "outputs": [
            {
                "internalType": "contract IHoneyTokenization",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_address",
                "type": "address"
            }
        ],
        "name": "isAdmin",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_honeyBatchId",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "_secretKey",
                "type": "string"
            }
        ],
        "name": "isKeyClaimed",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_admin",
                "type": "address"
            }
        ],
        "name": "removeAdmin",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

// ABI HoneyTokenization
export const HONEY_TOKENIZATION_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "producer",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "uri",
                "type": "string"
            }
        ],
        "name": "mintHoneyBatch",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "from",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
            }
        ],
        "name": "safeTransferFrom",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "tokenProducer",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    // 👇 AJOUTEZ CETTE FONCTION
    {
        inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],
        name: 'setApprovalForAll',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    // 👇 ET CELLE-CI POUR LA VÉRIFICATION
    {
        inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }],
        name: 'isApprovedForAll',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    }
] as const;
