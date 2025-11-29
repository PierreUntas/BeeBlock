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

        it("Should deploy HoneyTraceStorage with correct owner", async function () {
            expect(await honeyTraceStorage.owner()).to.equal(await owner.getAddress());
        });

        it("Should set owner as admin automatically", async function () {
            expect(await honeyTraceStorage.admins(await owner.getAddress())).to.equal(true);
        });

        it("Should link HoneyTokenization contract correctly", async function () {
            expect(await honeyTraceStorage.honeyTokenization()).to.equal(
                await honeyTokenization.getAddress()
            );
        });
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

        it("Should allow multiple admins", async function () {
            await honeyTraceStorage.addAdmin(await admin.getAddress());
            await honeyTraceStorage.addAdmin(await producer.getAddress());

            expect(await honeyTraceStorage.isAdmin(await admin.getAddress())).to.equal(true);
            expect(await honeyTraceStorage.isAdmin(await producer.getAddress())).to.equal(true);
        });
    })

    describe("Authorization", function () {

        beforeEach(async function () {
            await honeyTraceStorage.addAdmin(await admin.getAddress());
        })

        it("Should authorize a producer", async function () {

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

        it("Should prevent duplicate authorization", async function () {

            const producerAddress = await producer.getAddress();

            await honeyTraceStorage.connect(admin).authorizeProducer(producerAddress, true);

            await expect(
                honeyTraceStorage.connect(admin).authorizeProducer(producerAddress, true)
            ).to.be.revertedWithCustomError(honeyTraceStorage, "authorizationAlreadyApply");
        });

        it("Should allow admin to revoke producer authorization", async function () {

            const producerAddress = await producer.getAddress();

            await honeyTraceStorage.connect(admin).authorizeProducer(producerAddress, true);

            await expect(
                honeyTraceStorage.connect(admin).authorizeProducer(producerAddress, false)
            )
                .to.emit(honeyTraceStorage, "AuthorizationProducer")
                .withArgs(producerAddress, false);

            const producerData = await honeyTraceStorage.getProducer(producerAddress);
            expect(producerData.authorized).to.equal(false);
        });
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

        it("Should not allow unauthorized producer to create batch", async function () {
            const batch = generateTestBatch(5);

            await expect(
                honeyTraceStorage.connect(customer).addHoneyBatch(
                    "Fake Honey",
                    "{}",
                    5,
                    batch.merkleRoot
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "producerNotAuthorized");
        });


        it("Should create multiple batches with incremental IDs", async function () {
            const batch1 = generateTestBatch(5);
            const batch2 = generateTestBatch(10);

            await honeyTraceStorage.connect(producer).addHoneyBatch(
                "Miel d'Acacia",
                "{}",
                5,
                batch1.merkleRoot
            );

            await honeyTraceStorage.connect(producer).addHoneyBatch(
                "Miel de Lavande",
                "{}",
                10,
                batch2.merkleRoot
            );

            const honeyBatch1 = await honeyTraceStorage.getHoneyBatch(1);
            const honeyBatch2 = await honeyTraceStorage.getHoneyBatch(2);

            expect(honeyBatch1.id).to.equal(1);
            expect(honeyBatch2.id).to.equal(2);
            expect(honeyBatch1.honeyType).to.equal("Miel d'Acacia");
            expect(honeyBatch2.honeyType).to.equal("Miel de Lavande");
        });

        it("Should emit HoneyBatchMinted event from HoneyTokenization", async function () {
            const batch = generateTestBatch(5);

            await expect(
                honeyTraceStorage.connect(producer).addHoneyBatch(
                    "Miel de Châtaignier",
                    "{}",
                    5,
                    batch.merkleRoot
                )
            )
                .to.emit(honeyTokenization, "HoneyBatchMinted")
                .withArgs(await producer.getAddress(), 1, 5);
        });
    })

    describe("Token Claiming", function () {
        let batch: any;
        let batchId: number;

        beforeEach(async function () {
            await honeyTraceStorage.addAdmin(await admin.getAddress());
            await honeyTraceStorage.connect(admin).authorizeProducer(await producer.getAddress(), true);
            await honeyTraceStorage.connect(producer).addProducer(
                "Producer 1",
                "Paris",
                "123456",
                ""
            );

            batch = generateTestBatch(10);
            batchId = 1;

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
        });

        it("Should allow consumer to claim token with valid proof", async function () {
            const keyData = batch.keyWithProofs[0];

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    batchId,
                    keyData.secretKey,
                    keyData.proof
                )
            )
                .to.emit(honeyTraceStorage, "HoneyTokenClaimed")
                .withArgs(await customer.getAddress(), batchId, keyData.leaf);

            const customerBalance = await honeyTokenization.balanceOf(
                await customer.getAddress(),
                batchId
            );
            expect(customerBalance).to.equal(1);

            const isClaimed = await honeyTraceStorage.isKeyClaimed(batchId, keyData.secretKey);
            expect(isClaimed).to.equal(true);
        });

        it("Should reject claim with invalid Merkle proof", async function () {
            const keyData = batch.keyWithProofs[0];
            const fakeProof = ["0x" + "1".repeat(64), "0x" + "2".repeat(64)];

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    batchId,
                    keyData.secretKey,
                    fakeProof
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "invalidMerkleProof");
        });

        it("Should reject double claim with same key", async function () {
            const keyData = batch.keyWithProofs[0];

            await honeyTraceStorage.connect(customer).claimHoneyToken(
                batchId,
                keyData.secretKey,
                keyData.proof
            );

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    batchId,
                    keyData.secretKey,
                    keyData.proof
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "keyAlreadyClaimed");
        });

        it("Should reject claim when all tokens are claimed", async function () {
            for (let i = 0; i < 10; i++) {
                await honeyTraceStorage.connect(customer).claimHoneyToken(
                    batchId,
                    batch.keyWithProofs[i].secretKey,
                    batch.keyWithProofs[i].proof
                );
            }

            const remainingBalance = await honeyTokenization.balanceOf(
                await producer.getAddress(),
                batchId
            );
            expect(remainingBalance).to.equal(0);

            const extraBatch = generateTestBatch(11);

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    batchId,
                    extraBatch.keyWithProofs[10].secretKey,
                    extraBatch.keyWithProofs[10].proof
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "noTokenLeft");
        });

        it("Should not allow claim without producer approval", async function () {
            await honeyTraceStorage.connect(admin).authorizeProducer(await admin.getAddress(), true);
            await honeyTraceStorage.connect(admin).addProducer("Producer 2", "Lyon", "999", "");

            const batch2 = generateTestBatch(5);
            await honeyTraceStorage.connect(admin).addHoneyBatch(
                "Test Honey",
                "{}",
                5,
                batch2.merkleRoot
            );

            // Not call setApprovalForAll

            const keyData = batch2.keyWithProofs[0];

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    2, // nouveau batch ID
                    keyData.secretKey,
                    keyData.proof
                )
            ).to.be.revert(ethers);
        });


        it("Should reject claim with wrong secret key", async function () {
            const wrongKey = "wrong_secret_key_12345";
            const keyData = batch.keyWithProofs[0];

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    batchId,
                    wrongKey,
                    keyData.proof
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "invalidMerkleProof");
        });

        it("Should reject claim for non-existent batch", async function () {
            const keyData = batch.keyWithProofs[0];

            await expect(
                honeyTraceStorage.connect(customer).claimHoneyToken(
                    999, // Batch inexistant
                    keyData.secretKey,
                    keyData.proof
                )
            ).to.be.revertedWithCustomError(honeyTraceStorage, "noTokenLeft");
        });
    });

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