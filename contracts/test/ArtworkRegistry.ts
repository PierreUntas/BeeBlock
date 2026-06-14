import { expect } from "chai";
import { network } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { keccak256 } from "ethers";


const { ethers } = await network.connect();

function generateSecretKeys(amount: number) {
    const secretKeys = [];
    for (let i = 0; i < amount; i++) {
        // Generate 64-char hex string without 0x prefix, matching the frontend format
        secretKeys.push(ethers.hexlify(ethers.randomBytes(32)).slice(2));
    }

    // Double-hash leaves to match the contract: keccak256(keccak256(key))
    const leaves = secretKeys.map(key => keccak256(keccak256(ethers.toUtf8Bytes(key))));

    const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const merkleRoot = merkleTree.getHexRoot();

    const keyWithProofs = secretKeys.map((key, index) => ({
        secretKey: key,
        leaf: leaves[index],
        proof: merkleTree.getHexProof(leaves[index])
    }));

    return { merkleTree, merkleRoot, leaves, keyWithProofs, secretKeys }
}

describe("ArtworkRegistry", function () {
    let owner: any;
    let admin: any;
    let artist: any;
    let collector: any;
    let collector2: any;
    let artworkRegistry: any;
    let artworkTokenization: any;

    async function deployArtworkRegistery() {
        const [owner, admin, artist, collector, collector2] = await ethers.getSigners();
        const ArtworkTokenization = await ethers.getContractFactory("ArtworkTokenization");
        const artworkTokenization = await ArtworkTokenization.deploy("");
        const artworkTokenizationAddress = artworkTokenization.getAddress();
        const artworkRegistry = await ethers.deployContract("ArtworkRegistry", [artworkTokenizationAddress]);

        await artworkTokenization.transferOwnership(await artworkRegistry.getAddress());

        return { owner, admin, artist, collector, collector2, artworkRegistry, artworkTokenization }
    }

    beforeEach(async function () {
        const deployment = await deployArtworkRegistery();
        owner = deployment.owner;
        admin = deployment.admin;
        artist = deployment.artist;
        collector = deployment.collector;
        collector2 = deployment.collector2;
        artworkRegistry = deployment.artworkRegistry;
        artworkTokenization = deployment.artworkTokenization;
    })

    describe("Deployment", function () {
        it("Should deploy the ArtworkRegistery contract", async function () {
            expect(await artworkTokenization.owner()).to.equal(await artworkRegistry.getAddress());
        })

        it("Should deploy ArtworkRegistery with correct owner", async function () {
            expect(await artworkRegistry.owner()).to.equal(await owner.getAddress());
        })

        it("Should set owner as an admin automaticaly", async function () {
            expect(await artworkRegistry.admins(await owner.getAddress())).to.equal(true);
        })

        it("Should link ArtworkRegistery contract correctly", async function () {
            expect(await artworkRegistry.artworkTokenization()).to.equal(await artworkTokenization.getAddress());
        })
    })

    describe("Administration", function () {
        it("Should add a new admin", async function () {
            await artworkRegistry.addAdmin(admin.getAddress());
            expect(await artworkRegistry.isAdmin(admin.getAddress())).to.equal(true);
        })

        it("Should not allow non-owner to add a new admin", async function () {
            await expect(artworkRegistry.connect(artist).addAdmin(artist.getAddress()))
                .to.revertedWithCustomError(artworkRegistry, "OwnableUnauthorizedAccount");
        })

        it("Should allow multiple admins", async function () {
            await artworkRegistry.addAdmin(admin.getAddress());
            await artworkRegistry.addAdmin(artist.getAddress());
            expect(await artworkRegistry.isAdmin(admin.getAddress())).to.equal(true);
            expect(await artworkRegistry.isAdmin(artist.getAddress())).to.equal(true);
        })

        it("Should remove an admin", async function () {
            await artworkRegistry.addAdmin(admin.getAddress());

            await expect(artworkRegistry.removeAdmin(admin.getAddress()))
                .to.emit(artworkRegistry, "AdminRemoved")
                .withArgs(await admin.getAddress());

            expect(await artworkRegistry.isAdmin(admin.getAddress())).to.equal(false);
        })

        it("Should not allow non-owner to remove an admin", async function () {
            await artworkRegistry.addAdmin(admin.getAddress());

            await expect(artworkRegistry.connect(artist).removeAdmin(admin.getAddress()))
                .to.revertedWithCustomError(artworkRegistry, "OwnableUnauthorizedAccount");
        })

        it("Should not allow to remove a non-admin", async function () {
            await expect(artworkRegistry.removeAdmin(artist.getAddress()))
                .to.revertedWithCustomError(artworkRegistry, "NotAnAdmin");
        })
    })

    describe("Configuration", function () {
        it("Should update maxEditionSize", async function () {
            const newSize = 50000;
            await expect(artworkRegistry.setMaxEditionSize(newSize))
                .to.emit(artworkRegistry, "MaxEditionSizeUpdated")
                .withArgs(newSize);

            expect(await artworkRegistry.maxEditionSize()).to.equal(newSize);
        })

        it("Should not allow non-owner to update maxEditionSize", async function () {
            await expect(artworkRegistry.connect(artist).setMaxEditionSize(50000))
                .to.revertedWithCustomError(artworkRegistry, "OwnableUnauthorizedAccount");
        })

        it("Should not allow to set maxEditionSize to zero", async function () {
            await expect(artworkRegistry.setMaxEditionSize(0))
                .to.revertedWithCustomError(artworkRegistry, "InvalidConfigValue");
        })

        it("Should update maxReviewsPerUserAndEdition", async function () {
            const newLimit = 10;
            await expect(artworkRegistry.setMaxReviewsPerUserAndEdition(newLimit))
                .to.emit(artworkRegistry, "MaxReviewsPerUserAndEditionUpdated")
                .withArgs(newLimit);

            expect(await artworkRegistry.maxReviewsPerUserAndEdition()).to.equal(newLimit);
        })

        it("Should not allow non-owner to update maxReviewsPerUserAndEdition", async function () {
            await expect(artworkRegistry.connect(artist).setMaxReviewsPerUserAndEdition(10))
                .to.revertedWithCustomError(artworkRegistry, "OwnableUnauthorizedAccount");
        })

        it("Should not allow to set maxReviewsPerUserAndEdition to zero", async function () {
            await expect(artworkRegistry.setMaxReviewsPerUserAndEdition(0))
                .to.revertedWithCustomError(artworkRegistry, "InvalidConfigValue");
        })

        it("Should update maxReviewsQuery", async function () {
            const newLimit = 200;
            await expect(artworkRegistry.setMaxReviewsQuery(newLimit))
                .to.emit(artworkRegistry, "MaxReviewsQueryUpdated")
                .withArgs(newLimit);

            expect(await artworkRegistry.maxReviewsQuery()).to.equal(newLimit);
        })

        it("Should not allow non-owner to update maxReviewsQuery", async function () {
            await expect(artworkRegistry.connect(artist).setMaxReviewsQuery(200))
                .to.revertedWithCustomError(artworkRegistry, "OwnableUnauthorizedAccount");
        })

        it("Should not allow to set maxReviewsQuery to zero", async function () {
            await expect(artworkRegistry.setMaxReviewsQuery(0))
                .to.revertedWithCustomError(artworkRegistry, "InvalidConfigValue");
        })

        it("Should respect updated maxEditionSize when creating edition", async function () {
            await artworkRegistry.addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkTokenization.connect(artist).setApprovalForAll(artworkRegistry.getAddress(), true);

            const newSize = 100;
            await artworkRegistry.setMaxEditionSize(newSize);

            const edition = generateSecretKeys(5);
            const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";

            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, newSize, edition.merkleRoot);

            const edition2 = generateSecretKeys(5);
            await expect(artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 101, edition2.merkleRoot))
                .to.revertedWithCustomError(artworkRegistry, "EditionSizeTooLarge");
        })
    })

    describe("Authorization", function () {
        beforeEach(async function () {
            await artworkRegistry.addAdmin(admin.getAddress());
        })

        it("Should authorize an artist", async function () {
            const artistAddress = artist.getAddress();
            await artworkRegistry.connect(admin).authorizeArtist(artistAddress, true);
            const artistAuthorized = await artworkRegistry.getArtist(artistAddress);
            expect(artistAuthorized.authorized).to.equal(true);
        })

        it("Should not allow a non-admin to authorize an artist", async function () {
            await expect(artworkRegistry.connect(collector).authorizeArtist(artist.getAddress(), true))
                .to.revertedWithCustomError(artworkRegistry, "OnlyAdminAuthorized");
        })

        it("Should prevent of duplicate authorization", async function () {
            const artistAddress = artist.getAddress();

            await artworkRegistry.connect(admin).authorizeArtist(artist, true);

            await expect(artworkRegistry.connect(admin).authorizeArtist(artist, true)).to.revertedWithCustomError(artworkRegistry, "AuthorizationAlreadyApplied");
        })

        it("Should allow a admin to revoke artist authorization", async function () {
            const artistAddress = artist.getAddress();

            await artworkRegistry.connect(admin).authorizeArtist(artistAddress, true);

            await expect(artworkRegistry.connect(admin).authorizeArtist(artistAddress, false)).to.emit(artworkRegistry, "AuthorizationArtist").withArgs(artistAddress, false);

            const artistData = await artworkRegistry.getArtist(artistAddress);

            expect(artistData.authorized).to.equal(false);
        })
    })

    describe("Artists", function () {
        const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest"

        it("Should set artist info", async function () {
            await artworkRegistry.connect(owner).addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkRegistry.connect(artist).setArtistInfo(fakeCID);

            const newArtist = await artworkRegistry.getArtist(artist.getAddress());
            expect(newArtist.metadata).to.equal(fakeCID);
        })

        it("Should not allow non-authorized artist to set artist info", async function () {
            await expect(artworkRegistry.connect(artist).setArtistInfo(fakeCID))
                .to.revertedWithCustomError(artworkRegistry, "ArtistNotAuthorized");
        })

        it("Should check isArtistApproved correctly", async function () {
            await artworkRegistry.connect(owner).addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkTokenization.connect(artist).setApprovalForAll(artworkRegistry.getAddress(), true);

            expect(await artworkRegistry.isArtistApproved(artist.getAddress())).to.equal(true);

            await artworkTokenization.connect(artist).setApprovalForAll(artworkRegistry.getAddress(), false);

            expect(await artworkRegistry.isArtistApproved(artist.getAddress())).to.equal(false);
        })
    })

    describe("Artwork Editions", function () {
        const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";
        const newCID = "QmNewMetadataCIDCorrectLengthForTestingPurposesXX";
        let edition: any;
        let editionId: number;

        beforeEach(async function () {
            edition = generateSecretKeys(5);
            editionId = 1;

            await artworkRegistry.connect(owner).addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkRegistry.connect(artist).setArtistInfo(fakeCID);
            await artworkTokenization.connect(artist).setApprovalForAll(await artworkRegistry.getAddress(), true);

        })

        it("Should create an artwork edition", async function () {

            await expect(artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 10, edition.merkleRoot))
                .to.emit(artworkRegistry, "NewArtworkEdition")
                .withArgs(await artist.getAddress(), 1);

            const [metadata, merkleRoot] = await artworkRegistry.getArtworkEdition(1);

            expect(metadata).to.equal(fakeCID);
            expect(merkleRoot).to.equal(edition.merkleRoot);
        })

        it("Should not allow non-authorized artist to create an artwork edition", async function () {

            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), false);

            await expect(artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 10, edition.merkleRoot)).to.revertedWithCustomError(artworkRegistry, "ArtistNotAuthorized");
        })

        it("Should allow to set multiple artwork editions", async function () {
            const edition1 = generateSecretKeys(5);
            const edition2 = generateSecretKeys(5);

            await expect(artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 10, edition1.merkleRoot))
                .to.emit(artworkRegistry, "NewArtworkEdition")
                .withArgs(await artist.getAddress(), 1);

            await expect(artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 20, edition2.merkleRoot))
                .to.emit(artworkRegistry, "NewArtworkEdition")
                .withArgs(await artist.getAddress(), 2);

            const [metadata1, merkleRoot1] = await artworkRegistry.getArtworkEdition(1);
            const [metadata2, merkleRoot2] = await artworkRegistry.getArtworkEdition(2);

            expect(metadata1).to.equal(fakeCID);
            expect(merkleRoot1).to.equal(edition1.merkleRoot);
            expect(metadata2).to.equal(fakeCID);
            expect(merkleRoot2).to.equal(edition2.merkleRoot);
        })

        it("Should allow artist to update metadata before any claim", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.emit(artworkRegistry, "EditionMetadataUpdated")
                .withArgs(await artist.getAddress(), editionId, newCID);

            const [metadata] = await artworkRegistry.getArtworkEdition(editionId);
            expect(metadata).to.equal(newCID);
        })

        it("Should not allow to update metadata after a claim (balance < initial)", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.revertedWithCustomError(artworkRegistry, "MetadataLocked");
        })

        it("Should not allow to update metadata after a direct ERC-1155 transfer out of the artist's wallet", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            // The artist sells / sends a certificate off-platform, bypassing claimCertificate.
            // The balance drops below initial — metadata must be locked.
            await artworkTokenization.connect(artist).safeTransferFrom(
                await artist.getAddress(),
                await collector.getAddress(),
                editionId,
                1,
                "0x"
            );

            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.revertedWithCustomError(artworkRegistry, "MetadataLocked");
        })

        it("Should not allow to update metadata after a partial batch transfer", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            // Sell 2 out of 5 directly. Even partial outgoing transfer locks metadata.
            await artworkTokenization.connect(artist).safeTransferFrom(
                await artist.getAddress(),
                await collector.getAddress(),
                editionId,
                2,
                "0x"
            );

            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.revertedWithCustomError(artworkRegistry, "MetadataLocked");
        })

        it("Should still allow metadata update while artist holds the full initial supply", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            // No transfer happened: balance == initialEditionSize, update is allowed.
            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.emit(artworkRegistry, "EditionMetadataUpdated")
                .withArgs(await artist.getAddress(), editionId, newCID);
        })

        it("Should not allow another artist to update metadata", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);
            await artworkRegistry.connect(admin).authorizeArtist(collector.getAddress(), true);

            await expect(artworkRegistry.connect(collector).updateEditionMetadata(editionId, newCID))
                .to.revertedWithCustomError(artworkRegistry, "NotYourEdition");
        })

        it("Should report isEditionLocked correctly before and after first claim", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            const keyData = edition.keyWithProofs[0];

            expect(await artworkRegistry.isEditionLocked(editionId)).to.equal(false);

            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            expect(await artworkRegistry.isEditionLocked(editionId)).to.equal(true);
        })

        it("Should not allow to update metadata for non-existing edition", async function () {
            await expect(artworkRegistry.connect(artist).updateEditionMetadata(999, newCID))
                .to.revertedWithCustomError(artworkRegistry, "EditionDoesNotExist");
        })

        it("Should sync URI in ArtworkTokenization when metadata is updated", async function () {
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            await artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID);

            const [metadata] = await artworkRegistry.getArtworkEdition(editionId);
            expect(metadata).to.equal(newCID);

            const tokenURI = await artworkTokenization.uri(editionId);
            expect(tokenURI).to.equal(newCID);
        })
    })

    describe("Certificate Claiming", function () {
        let edition: any;
        let editionId: any;

        const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest"

        beforeEach(async function () {
            edition = generateSecretKeys(5);
            editionId = 1;

            await artworkRegistry.addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkTokenization.connect(artist).setApprovalForAll(artworkRegistry.getAddress(), true);
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

        })

        it("Should allow to claim a certificate with valid proof", async function () {
            const keyData = edition.keyWithProofs[0];

            await expect(artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof))
                .to.emit(artworkRegistry, "CertificateClaimed")
                .withArgs(collector.getAddress(), editionId);

            const collectorBalance = await artworkTokenization.balanceOf(collector.getAddress(), editionId);
            expect(collectorBalance).to.equal(1);

            const isClaimed = await artworkRegistry.isKeyClaimed(editionId, keyData.secretKey);
            expect(isClaimed).to.equal(true);
        })

        it("Should not allow to claim a certificate with invalid proof", async function () {
            const keyData = edition.keyWithProofs[0];
            const invalidProof = edition.keyWithProofs[1].proof; // Using proof from another key

            await expect(artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, invalidProof)).to.revertedWithCustomError(artworkRegistry, "InvalidMerkleProof");
        })

        it("Should not allow to claim a certificate with already claimed key", async function () {
            const keyData = edition.keyWithProofs[0];

            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            await expect(artworkRegistry.connect(collector2).claimCertificate(editionId, keyData.secretKey, keyData.proof)).to.revertedWithCustomError(artworkRegistry, "KeyAlreadyClaimed");
        })

        it("Should not allow to claim a certificate for non-existing edition", async function () {
            const keyData = edition.keyWithProofs[0];
            const nonExistingEditionId = 999;

            await expect(artworkRegistry.connect(collector).claimCertificate(nonExistingEditionId, keyData.secretKey, keyData.proof)).to.revertedWithCustomError(artworkRegistry, "EditionDoesNotExist");
        })

        it("Should not allow to claim when all certificates are claimed", async function () {

            for (let i = 0; i < edition.keyWithProofs.length; i++) {
                const keyData = edition.keyWithProofs[i];
                await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);
            }

            const remainingBalance = await artworkTokenization.balanceOf(artist.getAddress(), editionId);
            expect(remainingBalance).to.equal(0);

            const newKeyData = generateSecretKeys(1).keyWithProofs[0];

            await expect(artworkRegistry.connect(collector2).claimCertificate(editionId, newKeyData.secretKey, newKeyData.proof)).to.revertedWithCustomError(artworkRegistry, "NoCertificateLeft");

        })

        it("Should not allow to claim a certificate with a invalid key", async function () {
            const invalidKey = ethers.hexlify(ethers.randomBytes(32));
            const validProof = edition.keyWithProofs[0].proof;

            await expect(artworkRegistry.connect(collector).claimCertificate(editionId, invalidKey, validProof)).to.revertedWithCustomError(artworkRegistry, "InvalidMerkleProof");
        })
    })

    describe("Reviews", function () {
        let editionId: number;
        let edition: any;
        const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest"

        beforeEach(async function () {
            edition = generateSecretKeys(5);
            editionId = 1;

            await artworkRegistry.addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkTokenization.connect(artist).setApprovalForAll(artworkRegistry.getAddress(), true);
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);
        })

        it("Should allow to add a review to an artwork edition", async function () {
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";
            await expect(artworkRegistry.connect(collector).addReview(editionId, 5, fakeCID))
                .to.emit(artworkRegistry, "NewReview")
                .withArgs(await collector.getAddress(), editionId, 5);

            const reviews = await artworkRegistry.getEditionReviews(editionId, 0, 99);
            expect(reviews.length).to.equal(1);
            expect(reviews[0].collector).to.equal(await collector.getAddress());
            expect(reviews[0].editionId).to.equal(editionId);
            expect(reviews[0].rating).to.equal(5);
            expect(reviews[0].metadata).to.equal(fakeCID);
        })

        it("Should not allow to add a review without owning a certificate", async function () {
            const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";
            await expect(artworkRegistry.connect(collector).addReview(editionId, 5, fakeCID)).to.revertedWithCustomError(artworkRegistry, "NotAllowedToReview");
        })

        it("Should not allow to add a review with invalid rating", async function () {
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";
            await expect(artworkRegistry.connect(collector).addReview(editionId, 6, fakeCID)).to.revertedWithCustomError(artworkRegistry, "RatingOutOfRange");
        })

        it("Should not allow to add more than maxReviewsPerUserAndEdition reviews from the same collector", async function () {
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";
            await artworkRegistry.connect(collector).addReview(editionId, 5, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 4, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 3, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 2, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 1, fakeCID);
            await expect(artworkRegistry.connect(collector).addReview(editionId, 0, fakeCID)).to.revertedWithCustomError(artworkRegistry, "ReviewLimitReached");
        })

        it("Should return correct total review count", async function () {
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            await artworkRegistry.connect(collector).addReview(editionId, 5, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 4, fakeCID);

            const count = await artworkRegistry.getEditionReviewsCount(editionId);
            expect(count).to.equal(2);
        })

        it("Should paginate reviews correctly", async function () {
            const keyData1 = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData1.secretKey, keyData1.proof);
            await artworkRegistry.connect(collector).addReview(editionId, 5, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 4, fakeCID);

            const keyData2 = edition.keyWithProofs[1];
            await artworkRegistry.connect(collector2).claimCertificate(editionId, keyData2.secretKey, keyData2.proof);
            await artworkRegistry.connect(collector2).addReview(editionId, 3, fakeCID);

            const page1 = await artworkRegistry.getEditionReviews(editionId, 0, 2);
            expect(page1.length).to.equal(2);

            const page2 = await artworkRegistry.getEditionReviews(editionId, 2, 2);
            expect(page2.length).to.equal(1);
        })

        it("Should return empty array when startIndex is beyond total", async function () {
            const reviews = await artworkRegistry.getEditionReviews(editionId, 99, 10);
            expect(reviews.length).to.equal(0);
        })

        it("Should revert when limit exceeds maxReviewsQuery", async function () {
            await expect(artworkRegistry.getEditionReviews(editionId, 0, 101))
                .to.revertedWithCustomError(artworkRegistry, "QueryLimitTooHigh");
        })

        it("Should respect updated maxReviewsPerUserAndEdition", async function () {
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            await artworkRegistry.setMaxReviewsPerUserAndEdition(2);

            const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";
            await artworkRegistry.connect(collector).addReview(editionId, 5, fakeCID);
            await artworkRegistry.connect(collector).addReview(editionId, 4, fakeCID);
            
            await expect(artworkRegistry.connect(collector).addReview(editionId, 3, fakeCID))
                .to.revertedWithCustomError(artworkRegistry, "ReviewLimitReached");
        })

        it("Should respect updated maxReviewsQuery", async function () {
            await artworkRegistry.setMaxReviewsQuery(5);

            await expect(artworkRegistry.getEditionReviews(editionId, 0, 6))
                .to.revertedWithCustomError(artworkRegistry, "QueryLimitTooHigh");

            const reviews = await artworkRegistry.getEditionReviews(editionId, 0, 5);
            expect(reviews.length).to.equal(0); // No reviews yet, but no error
        })
    })

    describe("ArtworkTokenization Contract", function () {
        let edition: any;
        let editionId: number;
        let artworkTokenizationDirect: any;
        const fakeCID = "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest";

        beforeEach(async function () {
            edition = generateSecretKeys(5);
            editionId = 1;

            await artworkRegistry.addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkTokenization.connect(artist).setApprovalForAll(artworkRegistry.getAddress(), true);
            await artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 5, edition.merkleRoot);

            const ArtworkTokenization = await ethers.getContractFactory("ArtworkTokenization");
            artworkTokenizationDirect = await ArtworkTokenization.deploy("");
        })

        it("Should return the correct URI for tokens", async function () {
            const tokenURI = await artworkTokenization.uri(editionId);
            expect(tokenURI).to.equal(fakeCID);
        })

        it("Should return the correct balance for collectors", async function () {
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);

            const balance = await artworkTokenization.balanceOf(collector.getAddress(), editionId);
            expect(balance).to.equal(1);
        })

        it("Should track token artists correctly", async function () {
            const tokenArtist = await artworkTokenization.tokenArtist(editionId);
            expect(tokenArtist).to.equal(await artist.getAddress());
        })

        it("Should not allow direct minting of tokens (only through ArtworkRegistry)", async function () {
            await expect(artworkTokenization.connect(artist).mintArtworkEdition(artist.getAddress(), 5, fakeCID))
                .to.revertedWithCustomError(artworkTokenization, "OwnableUnauthorizedAccount");
        })

        it("Should revert when minting with zero address", async function () {
            await expect(
                artworkTokenizationDirect.connect(owner).mintArtworkEdition(
                    ethers.ZeroAddress,
                    5,
                    fakeCID
                )
            ).to.revertedWithCustomError(artworkTokenizationDirect, "InvalidArtistAddress");
        })

        it("Should revert when minting with zero amount", async function () {
            await expect(
                artworkTokenizationDirect.connect(owner).mintArtworkEdition(
                    artist.getAddress(),
                    0,
                    fakeCID
                )
            ).to.revertedWithCustomError(artworkTokenizationDirect, "InvalidAmount");
        })

        it("Should revert when minting with CID too short", async function () {
            await expect(
                artworkTokenizationDirect.connect(owner).mintArtworkEdition(
                    artist.getAddress(),
                    5,
                    "QmTooShort"
                )
            ).to.revertedWithCustomError(artworkTokenizationDirect, "InvalidIPFSCID");
        })

        it("Should revert when minting with CID too long", async function () {
            await expect(
                artworkTokenizationDirect.connect(owner).mintArtworkEdition(
                    artist.getAddress(),
                    5,
                    "Qm" + "a".repeat(100)
                )
            ).to.revertedWithCustomError(artworkTokenizationDirect, "InvalidIPFSCID");
        })

        it("Should not allow direct call to updateTokenMetadata (only through ArtworkRegistry)", async function () {
            await expect(artworkTokenization.connect(artist).updateTokenMetadata(editionId, "QmNewMetadataCIDCorrectLengthForTestingPurposesXX"))
                .to.revertedWithCustomError(artworkTokenization, "OwnableUnauthorizedAccount");
        })

        it("Should revert updateTokenMetadata with CID too short", async function () {
            await expect(
                artworkTokenizationDirect.connect(owner).updateTokenMetadata(1, "QmTooShort")
            ).to.revertedWithCustomError(artworkTokenizationDirect, "InvalidIPFSCID");
        })

        it("Should revert updateTokenMetadata with CID too long", async function () {
            await expect(
                artworkTokenizationDirect.connect(owner).updateTokenMetadata(1, "Qm" + "a".repeat(100))
            ).to.revertedWithCustomError(artworkTokenizationDirect, "InvalidIPFSCID");
        })

        it("Should emit TokenMetadataUpdated event when metadata is updated", async function () {
            const newCID = "QmNewMetadataCIDCorrectLengthForTestingPurposesXX";

            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.emit(artworkTokenization, "TokenMetadataUpdated")
                .withArgs(editionId, newCID);
        })

        it("Should emit standard EIP-1155 URI event when an edition is minted", async function () {
            const newEdition = generateSecretKeys(3);

            await expect(artworkRegistry.connect(artist).createArtworkEdition(fakeCID, 3, newEdition.merkleRoot))
                .to.emit(artworkTokenization, "URI")
                .withArgs(fakeCID, 2); // editionId 2 because the beforeEach already minted #1
        })

        it("Should emit standard EIP-1155 URI event when metadata is updated", async function () {
            const newCID = "QmNewMetadataCIDCorrectLengthForTestingPurposesXX";

            await expect(artworkRegistry.connect(artist).updateEditionMetadata(editionId, newCID))
                .to.emit(artworkTokenization, "URI")
                .withArgs(newCID, editionId);
        })
    })

    describe("Advanced Cases", function () {
        beforeEach(async function () {
            await artworkRegistry.addAdmin(admin.getAddress());
            await artworkRegistry.connect(admin).authorizeArtist(artist.getAddress(), true);
            await artworkTokenization.connect(artist).setApprovalForAll(await artworkRegistry.getAddress(), true);
            await artworkRegistry.connect(artist).setArtistInfo("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest");
        })

        it("Should be gas efficient when creating an artwork edition with many certificates (10000)", async function () {
            const edition = generateSecretKeys(10000);
            const tx = await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 1000, edition.merkleRoot);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed;

            expect(gasUsed).to.be.lessThan(300000);
        })

        it("Should disable an edition and block new claims", async function () {
            const edition = generateSecretKeys(5);
            const editionId = 1;
            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);

            await expect(artworkRegistry.connect(admin).disableEdition(editionId))
                .to.emit(artworkRegistry, "EditionDisabled")
                .withArgs(editionId, await admin.getAddress());

            const keyData = edition.keyWithProofs[0];
            await expect(artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof))
                .to.revertedWithCustomError(artworkRegistry, "EditionIsDisabled");
        })

        it("Should not allow disabling an already disabled edition", async function () {
            const edition = generateSecretKeys(5);
            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);
            await artworkRegistry.connect(admin).disableEdition(1);
            await expect(artworkRegistry.connect(admin).disableEdition(1))
                .to.revertedWithCustomError(artworkRegistry, "EditionAlreadyDisabled");
        })

        it("Should not allow non-admin to disable an edition", async function () {
            const edition = generateSecretKeys(5);
            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);
            await expect(artworkRegistry.connect(collector).disableEdition(1))
                .to.revertedWithCustomError(artworkRegistry, "OnlyAdminAuthorized");
        })

        it("Should replace Merkle root on a disabled edition and allow claim with new key", async function () {
            const edition = generateSecretKeys(5);
            const editionId = 1;
            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);

            await artworkRegistry.connect(admin).disableEdition(editionId);

            const newEdition = generateSecretKeys(5);
            await expect(artworkRegistry.connect(admin).replaceEditionMerkleRoot(editionId, newEdition.merkleRoot))
                .to.emit(artworkRegistry, "EditionMerkleRootReplaced")
                .withArgs(editionId, newEdition.merkleRoot);

            const keyData = newEdition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);
            const balance = await artworkTokenization.balanceOf(collector.getAddress(), editionId);
            expect(balance).to.equal(1);
        })

        it("Should not allow replacing Merkle root on an active (non-disabled) edition", async function () {
            const edition = generateSecretKeys(5);
            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);
            const newEdition = generateSecretKeys(5);
            await expect(artworkRegistry.connect(admin).replaceEditionMerkleRoot(1, newEdition.merkleRoot))
                .to.revertedWithCustomError(artworkRegistry, "EditionNotDisabled");
        })

        it("Should not allow review on a disabled edition", async function () {
            const edition = generateSecretKeys(5);
            const editionId = 1;
            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);
            const keyData = edition.keyWithProofs[0];
            await artworkRegistry.connect(collector).claimCertificate(editionId, keyData.secretKey, keyData.proof);
            await artworkRegistry.connect(admin).disableEdition(editionId);
            await expect(artworkRegistry.connect(collector).addReview(editionId, 5, "QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest"))
                .to.revertedWithCustomError(artworkRegistry, "EditionIsDisabled");
        })

        it("Should handle artist transfering certificates manually", async function () {
            const edition = generateSecretKeys(5);
            const editionId = 1;

            await artworkRegistry.connect(artist).createArtworkEdition("QmYwAPJzv5CZsnANOTaREALcidButCorrectLengthForTest", 5, edition.merkleRoot);

            await artworkTokenization.connect(artist).safeTransferFrom(
                artist.getAddress(),
                collector.getAddress(),
                editionId,
                1,
                "0x"
            );

            const balance = await artworkTokenization.balanceOf(collector.getAddress(), editionId);
            expect(balance).to.equal(1);
        })
    })
})
