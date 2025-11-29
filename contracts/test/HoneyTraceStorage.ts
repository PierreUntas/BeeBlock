import {expect} from "chai";
import {network} from "hardhat";
import {MerkleTree} from 'merkletreejs';
import {keccak256} from "ethers";

const {ethers} = await network.connect();

function generateTestBatch(amount: number) {
    const secretKeys = [];
    for (let i = 0; i < amount; i++) {
        secretKeys.push(ethers.hexlify(ethers.randomBytes(32)));
    }

    const leaves = secretKeys.map(key => keccak256(ethers.toUtf8Bytes(key)));

    const merkleTree = new MerkleTree(leaves, keccak256, {sortPairs: true});
    const merkleRoot = merkleTree.getHexRoot();

    const keyWithProofs = secretKeys.map((key, index) => ({
        secretKey: key,
        leaf: leaves[index],
        proof: merkleTree.getHexProof(leaves[index])
    }));

    return {merkleTree, merkleRoot, leaves, keyWithProofs, secretKeys};
}

describe("HoneyTraceStorage", function () {
    let owner: any;
    let admin: any;
    let producer: any;
    let customer: any;
    let honeyTraceStorage: any;
    let honeyTokenization: any;

    async function deployHoneyTraceStorage() {
        const [owner, admin, producer, customer] = await ethers.getSigners();
        const HoneyTokenization = await ethers.getContractFactory("HoneyTokenization");
        const honeyTokenization = await HoneyTokenization.deploy("");
        const honeyTokenizationAddress = honeyTokenization.getAddress();
        const honeyTraceStorage = await ethers.deployContract("HoneyTraceStorage", [honeyTokenizationAddress]);

        await honeyTokenization.transferOwnership(await honeyTraceStorage.getAddress());

        return {owner, admin, producer, customer, honeyTraceStorage, honeyTokenization};
    }

    beforeEach(async function () {
        const deployment = await deployHoneyTraceStorage();
        owner = deployment.owner;
        admin = deployment.admin;
        producer = deployment.producer;
        customer = deployment.customer;
        honeyTraceStorage = deployment.honeyTraceStorage;
        honeyTokenization = deployment.honeyTokenization;
    })

    describe("Deployment", function () {
        it("Should deploy the HoneyTraceStorage contract", async function () {
            expect(await honeyTokenization.owner()).to.equal(await honeyTraceStorage.getAddress());
        })
    })

    describe("Administration", function () {
        it("Should add a new admin", async function () {
            const adminAddress = admin.getAddress();
            await honeyTraceStorage.addAdmin(adminAddress);
            expect(await honeyTraceStorage.isAdmin(adminAddress)).to.equal(true);
        })
        it("Should not allow non-owner to add a new admin", async function () {
            const adminAddress = admin.getAddress();
            await expect(
                honeyTraceStorage.connect(producer).addAdmin(adminAddress)
            ).to.be.revertedWithCustomError(honeyTraceStorage, "OwnableUnauthorizedAccount");
        })
    })

    describe("Authorization", function () {
        it("Should authorize a producer", async function () {
            await honeyTraceStorage.connect(owner).addAdmin(await admin.getAddress());

            const producerAddress = await producer.getAddress();

            await honeyTraceStorage.connect(admin).authorizeProducer(producerAddress, true);
            const producerAuthorized = await honeyTraceStorage.getProducer(producerAddress);
            expect(producerAuthorized.authorized).to.equal(true);

        })
        it("Should not allow non-admin to authorize a producer", async function () {
            const producerAddress = await producer.getAddress();
            await expect(
                honeyTraceStorage.connect(producer).authorizeProducer(producerAddress, true)
            ).to.be.revertedWithCustomError(honeyTraceStorage, "onlyAdminAuthorized");
        })
    })

    describe("Producers", function () {
        it("Should add a new producer", async function () {
            await honeyTraceStorage.connect(owner).addAdmin(await admin.getAddress());
            await honeyTraceStorage.connect(admin).authorizeProducer(await producer.getAddress(), true);
            await honeyTraceStorage.connect(producer).addProducer("producer 1", "Town", "1234", "");

            const newProducer = await honeyTraceStorage.getProducer(await producer.getAddress());

            expect(newProducer.name).to.equal("producer 1");
            expect(newProducer.location).to.equal("Town");
            expect(newProducer.companyRegisterNumber).to.equal("1234");
            expect(newProducer.metadata).to.equal("");
        })
        it("Should not allow non-authorized producer to add a new producer", async function () {
            await expect(honeyTraceStorage.connect(customer).addProducer("producer 1", "Town", "1234", "")
            ).to.be.revertedWithCustomError(honeyTraceStorage, "producerNotAuthorized");
        })
    })

    describe("Honey Batches", function () {
        beforeEach(async function () {
            await honeyTraceStorage.connect(owner).addAdmin(await admin.getAddress());
            await honeyTraceStorage.connect(admin).authorizeProducer(await producer.getAddress(), true);
            await honeyTraceStorage.connect(producer).addProducer("producer 1", "Town", "1234", "");
        })

        it("Should add a new honey batch", async function () {
            const batch = generateTestBatch(10);

            await expect(honeyTraceStorage.connect(producer).addHoneyBatch(
                "Miel d'Acacia",
                '{"origin":"France"}',
                10,
                batch.merkleRoot
            )).to.emit(honeyTraceStorage, "NewHoneyBatch").withArgs(
                await producer.getAddress(), 1);

            const honeyBatch = await honeyTraceStorage.getHoneyBatch(1);
            expect(honeyBatch.id).to.equal(1);
            expect(honeyBatch.honeyType).to.equal("Miel d'Acacia");
            expect(honeyBatch.merkleRoot).to.equal(batch.merkleRoot);

            const producerBalance = await honeyTokenization.balanceOf(await producer.getAddress(), 1);
            expect(producerBalance).to.equal(10);
        });

        it("Should allow customer to claim token", async function () {
            const batch = generateTestBatch(10);
            await honeyTraceStorage.connect(producer).addHoneyBatch(
                "Miel d'Acacia",
                "ipfs://metadata",
                10,
                batch.merkleRoot
            );

            await honeyTokenization.connect(producer).setApprovalForAll(honeyTraceStorage.getAddress(), true);

            const key = batch.keyWithProofs[0];

            await expect(honeyTraceStorage.connect(customer).claimHoneyToken(
                    1,
                    key.secretKey,
                    key.proof
                )
            ).to.emit(honeyTraceStorage, "HoneyTokenClaimed").withArgs(customer.getAddress(), 1, key.leaf);

            const customerBalance = await honeyTokenization.balanceOf(await customer.getAddress(), 1);
            expect(customerBalance).to.equal(1);

            const isClaimed = await honeyTraceStorage.isKeyClaimed(1, key.secretKey);
            expect(isClaimed).to.equal(true);
        })
    })

    describe("Comments", function () {
        beforeEach(async function () {
            await honeyTraceStorage.connect(owner).addAdmin(await admin.getAddress());
            await honeyTraceStorage.connect(admin).authorizeProducer(await producer.getAddress(), true);
            await honeyTraceStorage.connect(producer).addProducer("Producer 1", "Paris", "123456", "");

            const batch = generateTestBatch(10);
            await honeyTraceStorage.connect(producer).addHoneyBatch(
                "Miel d'Acacia",
                "ipfs://metadata",
                10,
                batch.merkleRoot
            );

            await honeyTokenization.connect(producer).setApprovalForAll(
                await honeyTraceStorage.getAddress(),
                true
            );

            await honeyTraceStorage.connect(customer).claimHoneyToken(
                1,
                batch.keyWithProofs[0].secretKey,
                batch.keyWithProofs[0].proof
            );
        });

        it("Should allow token holder to add comment", async function () {
            await expect(
                honeyTraceStorage.connect(customer).addComment(
                    1,
                    5,
                    "ipfs://metadata"
                )
            ).to.emit(honeyTraceStorage, "NewComment")
                .withArgs(await customer.getAddress(), 1, 5);

            const comments = await honeyTraceStorage.getHoneyBatchComments(1);
            expect(comments.length).to.equal(1);
            expect(comments[0].rating).to.equal(5);
            expect(comments[0].metadata).to.equal("ipfs://metadata");
        });

        it("Should not allow token non-holder to add comment", async function () {
            await expect(
                honeyTraceStorage.connect(admin).addComment(
                    1,
                    5,
                    "ipfs://metadata"
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "notAllowedToComment");
        });
    })
});

// Penser à vérifier les évènements