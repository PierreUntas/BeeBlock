// Sources flattened with hardhat v3.0.15 https://hardhat.org
// SPDX-License-Identifier: MIT
// File npm/@openzeppelin/contracts@5.4.0/utils/Context.sol
// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)
pragma solidity ^0.8.20;
/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}
// File npm/@openzeppelin/contracts@5.4.0/access/Ownable.sol
// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)
pragma solidity ^0.8.20;
/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;
    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);
    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }
    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }
    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }
    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }
    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
// File npm/@openzeppelin/contracts@5.4.0/utils/cryptography/Hashes.sol
// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.3.0) (utils/cryptography/Hashes.sol)
pragma solidity ^0.8.20;
/**
 * @dev Library of standard hash functions.
 *
 * _Available since v5.1._
 */
library Hashes {
    /**
     * @dev Commutative Keccak256 hash of a sorted pair of bytes32. Frequently used when working with merkle proofs.
     *
     * NOTE: Equivalent to the `standardNodeHash` in our https://github.com/OpenZeppelin/merkle-tree[JavaScript library].
     */
    function commutativeKeccak256(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? efficientKeccak256(a, b) : efficientKeccak256(b, a);
    }
    /**
     * @dev Implementation of keccak256(abi.encode(a, b)) that doesn't allocate or expand memory.
     */
    function efficientKeccak256(bytes32 a, bytes32 b) internal pure returns (bytes32 value) {
        assembly ("memory-safe") {
            mstore(0x00, a)
            mstore(0x20, b)
            value := keccak256(0x00, 0x40)
        }
    }
}
// File npm/@openzeppelin/contracts@5.4.0/utils/cryptography/MerkleProof.sol
// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/cryptography/MerkleProof.sol)
// This file was procedurally generated from scripts/generate/templates/MerkleProof.js.
pragma solidity ^0.8.20;
/**
 * @dev These functions deal with verification of Merkle Tree proofs.
 *
 * The tree and the proofs can be generated using our
 * https://github.com/OpenZeppelin/merkle-tree[JavaScript library].
 * You will find a quickstart guide in the readme.
 *
 * WARNING: You should avoid using leaf values that are 64 bytes long prior to
 * hashing, or use a hash function other than keccak256 for hashing leaves.
 * This is because the concatenation of a sorted pair of internal nodes in
 * the Merkle tree could be reinterpreted as a leaf value.
 * OpenZeppelin's JavaScript library generates Merkle trees that are safe
 * against this attack out of the box.
 *
 * IMPORTANT: Consider memory side-effects when using custom hashing functions
 * that access memory in an unsafe way.
 *
 * NOTE: This library supports proof verification for merkle trees built using
 * custom _commutative_ hashing functions (i.e. `H(a, b) == H(b, a)`). Proving
 * leaf inclusion in trees built using non-commutative hashing functions requires
 * additional logic that is not supported by this library.
 */
library MerkleProof {
    /**
     *@dev The multiproof provided is not valid.
     */
    error MerkleProofInvalidMultiproof();
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with the default hashing function.
     */
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProof(proof, leaf) == root;
    }
    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with the default hashing function.
     */
    function processProof(bytes32[] memory proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = Hashes.commutativeKeccak256(computedHash, proof[i]);
        }
        return computedHash;
    }
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with a custom hashing function.
     */
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processProof(proof, leaf, hasher) == root;
    }
    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in memory with a custom hashing function.
     */
    function processProof(
        bytes32[] memory proof,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = hasher(computedHash, proof[i]);
        }
        return computedHash;
    }
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with the default hashing function.
     */
    function verifyCalldata(bytes32[] calldata proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        return processProofCalldata(proof, leaf) == root;
    }
    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with the default hashing function.
     */
    function processProofCalldata(bytes32[] calldata proof, bytes32 leaf) internal pure returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = Hashes.commutativeKeccak256(computedHash, proof[i]);
        }
        return computedHash;
    }
    /**
     * @dev Returns true if a `leaf` can be proved to be a part of a Merkle tree
     * defined by `root`. For this, a `proof` must be provided, containing
     * sibling hashes on the branch from the leaf to the root of the tree. Each
     * pair of leaves and each pair of pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with a custom hashing function.
     */
    function verifyCalldata(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processProofCalldata(proof, leaf, hasher) == root;
    }
    /**
     * @dev Returns the rebuilt hash obtained by traversing a Merkle tree up
     * from `leaf` using `proof`. A `proof` is valid if and only if the rebuilt
     * hash matches the root of the tree. When processing the proof, the pairs
     * of leaves & pre-images are assumed to be sorted.
     *
     * This version handles proofs in calldata with a custom hashing function.
     */
    function processProofCalldata(
        bytes32[] calldata proof,
        bytes32 leaf,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            computedHash = hasher(computedHash, proof[i]);
        }
        return computedHash;
    }
    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in memory with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProof}.
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProof(proof, proofFlags, leaves) == root;
    }
    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in memory with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;
        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }
        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](proofFlagsLen);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < proofFlagsLen; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = Hashes.commutativeKeccak256(a, b);
        }
        if (proofFlagsLen > 0) {
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }
    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in memory with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProof}.
     */
    function multiProofVerify(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32 root,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processMultiProof(proof, proofFlags, leaves, hasher) == root;
    }
    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in memory with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProof(
        bytes32[] memory proof,
        bool[] memory proofFlags,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;
        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }
        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](proofFlagsLen);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < proofFlagsLen; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = hasher(a, b);
        }
        if (proofFlagsLen > 0) {
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }
    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in calldata with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProofCalldata}.
     */
    function multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    ) internal pure returns (bool) {
        return processMultiProofCalldata(proof, proofFlags, leaves) == root;
    }
    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in calldata with the default hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;
        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }
        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](proofFlagsLen);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < proofFlagsLen; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = Hashes.commutativeKeccak256(a, b);
        }
        if (proofFlagsLen > 0) {
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }
    /**
     * @dev Returns true if the `leaves` can be simultaneously proven to be a part of a Merkle tree defined by
     * `root`, according to `proof` and `proofFlags` as described in {processMultiProof}.
     *
     * This version handles multiproofs in calldata with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. See {processMultiProof} for details.
     *
     * NOTE: Consider the case where `root == proof[0] && leaves.length == 0` as it will return `true`.
     * The `leaves` must be validated independently. See {processMultiProofCalldata}.
     */
    function multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bool) {
        return processMultiProofCalldata(proof, proofFlags, leaves, hasher) == root;
    }
    /**
     * @dev Returns the root of a tree reconstructed from `leaves` and sibling nodes in `proof`. The reconstruction
     * proceeds by incrementally reconstructing all inner nodes by combining a leaf/inner node with either another
     * leaf/inner node or a proof sibling node, depending on whether each `proofFlags` item is true or false
     * respectively.
     *
     * This version handles multiproofs in calldata with a custom hashing function.
     *
     * CAUTION: Not all Merkle trees admit multiproofs. To use multiproofs, it is sufficient to ensure that: 1) the tree
     * is complete (but not necessarily perfect), 2) the leaves to be proven are in the opposite order they are in the
     * tree (i.e., as seen from right to left starting at the deepest layer and continuing at the next layer).
     *
     * NOTE: The _empty set_ (i.e. the case where `proof.length == 1 && leaves.length == 0`) is considered a no-op,
     * and therefore a valid multiproof (i.e. it returns `proof[0]`). Consider disallowing this case if you're not
     * validating the leaves elsewhere.
     */
    function processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves,
        function(bytes32, bytes32) view returns (bytes32) hasher
    ) internal view returns (bytes32 merkleRoot) {
        // This function rebuilds the root hash by traversing the tree up from the leaves. The root is rebuilt by
        // consuming and producing values on a queue. The queue starts with the `leaves` array, then goes onto the
        // `hashes` array. At the end of the process, the last hash in the `hashes` array should contain the root of
        // the Merkle tree.
        uint256 leavesLen = leaves.length;
        uint256 proofFlagsLen = proofFlags.length;
        // Check proof validity.
        if (leavesLen + proof.length != proofFlagsLen + 1) {
            revert MerkleProofInvalidMultiproof();
        }
        // The xxxPos values are "pointers" to the next value to consume in each array. All accesses are done using
        // `xxx[xxxPos++]`, which return the current value and increment the pointer, thus mimicking a queue's "pop".
        bytes32[] memory hashes = new bytes32[](proofFlagsLen);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;
        // At each step, we compute the next hash using two values:
        // - a value from the "main queue". If not all leaves have been consumed, we get the next leaf, otherwise we
        //   get the next hash.
        // - depending on the flag, either another value from the "main queue" (merging branches) or an element from the
        //   `proof` array.
        for (uint256 i = 0; i < proofFlagsLen; i++) {
            bytes32 a = leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++];
            bytes32 b = proofFlags[i]
                ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++])
                : proof[proofPos++];
            hashes[i] = hasher(a, b);
        }
        if (proofFlagsLen > 0) {
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[proofFlagsLen - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }
}
// File npm/@openzeppelin/contracts@5.4.0/utils/ReentrancyGuard.sol
// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)
pragma solidity ^0.8.20;
/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.
    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();
    constructor() {
        _status = NOT_ENTERED;
    }
    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }
    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }
    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }
    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}
// File contracts/ArtworkRegistry.sol
// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.28;
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
     * @param hasBeenClaimed Flag indicating if at least one certificate has been claimed (locks metadata)
     */
    struct ArtworkEdition {
        bytes32 merkleRoot;
        bool hasBeenClaimed;
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
        emit NewArtworkEdition(msg.sender, tokenId);
    }
    /**
     * @dev Allows an artist to update edition metadata ONLY before any certificate has been claimed
     * @param _editionId ID of the edition to update
     * @param _newMetadata New IPFS CID pointing to updated edition metadata JSON
     *
     * This ensures that once a collector has purchased and claimed a certificate,
     * the edition information becomes permanently immutable, maintaining authenticity integrity.
     *
     * Requirements:
     * - Caller must be an authorized artist
     * - Artist must be the creator of this edition
     * - NO certificate must have been claimed yet (hasBeenClaimed = false)
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
        require(!edition.hasBeenClaimed, MetadataLocked());
        address artist = artworkTokenization.tokenArtist(_editionId);
        require(artist == msg.sender, NotYourEdition());
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
        edition.hasBeenClaimed = true;
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
     * @return hasBeenClaimed Whether at least one certificate has been claimed
     * @return disabled Whether the edition has been disabled by an admin
     */
    function getArtworkEdition(uint _id) external view returns (
        string memory metadata,
        bytes32 merkleRoot,
        bool hasBeenClaimed,
        bool disabled
    ) {
        ArtworkEdition storage edition = artworkEditions[_id];
        return (
            artworkTokenization.uri(_id),
            edition.merkleRoot,
            edition.hasBeenClaimed,
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
     * @dev Checks if an edition has had any certificates claimed (metadata locked)
     * @param _editionId ID of the edition to check
     * @return True if at least one certificate has been claimed, false otherwise
     */
    function isEditionLocked(uint256 _editionId) external view returns (bool) {
        return artworkEditions[_editionId].hasBeenClaimed;
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
