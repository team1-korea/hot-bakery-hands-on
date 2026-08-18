// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {Deploy} from "../script/Deploy.s.sol";
import {AvalancheBakeryCertificate} from "../src/AvalancheBakeryCertificate.sol";
import {IERC5192} from "../src/interfaces/IERC5192.sol";

contract NonReceiver {}

contract RevertingReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        revert("receiver rejected token");
    }
}

contract AvalancheBakeryCertificateTest is Test {
    AvalancheBakeryCertificate internal certificate;

    address internal admin = makeAddr("admin");
    address internal minter = makeAddr("minter");
    address internal participant = makeAddr("participant");
    address internal participantTwo = makeAddr("participantTwo");
    address internal outsider = makeAddr("outsider");

    bytes32 internal defaultAdminRole;
    bytes32 internal minterRole;
    bytes32 internal recoveryRole;

    string internal constant URI_ONE = "ipfs://metadata/1.json";
    string internal constant URI_TWO = "ipfs://metadata/2.json";

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event MetadataUpdate(uint256 tokenId);
    event Locked(uint256 tokenId);
    event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string tokenURI);
    event CertificateRevoked(uint256 indexed tokenId, address indexed holder);
    event CertificateReissued(
        uint256 indexed burnedTokenId, uint256 indexed newTokenId, address indexed recipient, string tokenURI
    );

    function setUp() public {
        certificate = new AvalancheBakeryCertificate(admin, minter);
        defaultAdminRole = certificate.DEFAULT_ADMIN_ROLE();
        minterRole = certificate.MINTER_ROLE();
        recoveryRole = certificate.RECOVERY_ROLE();
    }

    function testConstructorRejectsZeroAdmin() public {
        vm.expectRevert(AvalancheBakeryCertificate.InvalidAdmin.selector);
        new AvalancheBakeryCertificate(address(0), minter);
    }

    function testConstructorRejectsZeroMinter() public {
        vm.expectRevert(AvalancheBakeryCertificate.InvalidMinter.selector);
        new AvalancheBakeryCertificate(admin, address(0));
    }

    function testConstructorAssignsSeparatedRoles() public view {
        assertTrue(certificate.hasRole(certificate.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(certificate.hasRole(certificate.RECOVERY_ROLE(), admin));
        assertTrue(certificate.hasRole(certificate.MINTER_ROLE(), minter));
        assertFalse(certificate.hasRole(certificate.MINTER_ROLE(), admin));
        assertFalse(certificate.hasRole(certificate.DEFAULT_ADMIN_ROLE(), minter));
        assertFalse(certificate.hasRole(certificate.RECOVERY_ROLE(), minter));
    }

    function testConstructorAllowsSameAdminAndMinter() public {
        AvalancheBakeryCertificate combined = new AvalancheBakeryCertificate(admin, admin);
        assertTrue(combined.hasRole(combined.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(combined.hasRole(combined.RECOVERY_ROLE(), admin));
        assertTrue(combined.hasRole(combined.MINTER_ROLE(), admin));
    }

    function testMinterCanMintAndStateIsQueryable() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        assertEq(tokenId, 1);
        assertEq(certificate.ownerOf(tokenId), participant);
        assertEq(certificate.tokenURI(tokenId), URI_ONE);
        assertTrue(certificate.hasBeenIssued(participant));
        assertEq(certificate.nextTokenId(), 2);
    }

    function testMintEmitsLockedAndCertificateIssued() public {
        vm.startPrank(minter);

        vm.expectEmit(true, true, true, true, address(certificate));
        emit Transfer(address(0), participant, 1);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit MetadataUpdate(1);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit Locked(1);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit CertificateIssued(1, participant, URI_ONE);

        certificate.mint(participant, URI_ONE);
        vm.stopPrank();
    }

    function testUnauthorizedMintReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, certificate.MINTER_ROLE()
            )
        );
        vm.prank(outsider);
        certificate.mint(participant, URI_ONE);
    }

    function testMintRejectsZeroRecipient() public {
        vm.prank(minter);
        vm.expectRevert(AvalancheBakeryCertificate.InvalidRecipient.selector);
        certificate.mint(address(0), URI_ONE);
    }

    function testMintRejectsEmptyURI() public {
        vm.prank(minter);
        vm.expectRevert(AvalancheBakeryCertificate.EmptyTokenURI.selector);
        certificate.mint(participant, "");
    }

    function testMintRejectsSecondOrdinaryIssuance() public {
        _mint(participant, URI_ONE);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBakeryCertificate.AlreadyIssued.selector, participant));
        certificate.mint(participant, URI_TWO);
    }

    function testTokenIdsStartAtOneAndIncreaseSequentially() public {
        assertEq(_mint(participant, URI_ONE), 1);
        assertEq(_mint(participantTwo, URI_TWO), 2);
        assertEq(certificate.nextTokenId(), 3);
    }

    function testLockedReturnsTrueForExistingToken() public {
        uint256 tokenId = _mint(participant, URI_ONE);
        assertTrue(certificate.locked(tokenId));
    }

    function testLockedRevertsForNonexistentToken() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 77));
        certificate.locked(77);
    }

    function testSupportsRequiredInterfaces() public view {
        assertTrue(certificate.supportsInterface(type(IERC721).interfaceId));
        assertTrue(certificate.supportsInterface(type(IERC721Metadata).interfaceId));
        assertTrue(certificate.supportsInterface(type(IAccessControl).interfaceId));
        assertTrue(certificate.supportsInterface(type(IERC5192).interfaceId));
        assertEq(type(IERC5192).interfaceId, bytes4(0xb45a3c0e));
    }

    function testTransferFromReverts() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.prank(participant);
        vm.expectRevert(AvalancheBakeryCertificate.SoulboundTransferNotAllowed.selector);
        certificate.transferFrom(participant, participantTwo, tokenId);
    }

    function testSafeTransferFromWithoutDataReverts() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.prank(participant);
        vm.expectRevert(AvalancheBakeryCertificate.SoulboundTransferNotAllowed.selector);
        certificate.safeTransferFrom(participant, participantTwo, tokenId);
    }

    function testSafeTransferFromWithDataReverts() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.prank(participant);
        vm.expectRevert(AvalancheBakeryCertificate.SoulboundTransferNotAllowed.selector);
        certificate.safeTransferFrom(participant, participantTwo, tokenId, hex"1234");
    }

    function testApproveRevertsAndReadRemainsCompatible() public {
        uint256 tokenId = _mint(participant, URI_ONE);
        assertEq(certificate.getApproved(tokenId), address(0));

        vm.prank(participant);
        vm.expectRevert(AvalancheBakeryCertificate.SoulboundApprovalNotAllowed.selector);
        certificate.approve(outsider, tokenId);
    }

    function testSetApprovalForAllRevertsAndReadRemainsCompatible() public {
        assertFalse(certificate.isApprovedForAll(participant, outsider));

        vm.prank(participant);
        vm.expectRevert(AvalancheBakeryCertificate.SoulboundApprovalNotAllowed.selector);
        certificate.setApprovalForAll(outsider, true);
    }

    function testSoulboundPolicyDoesNotBlockMintOrAdminBurn() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.prank(admin);
        certificate.adminBurn(tokenId);

        assertTrue(certificate.reissueAvailable(tokenId));
    }

    function testBatchMintSucceeds() public {
        address[] memory recipients = new address[](2);
        recipients[0] = participant;
        recipients[1] = participantTwo;
        string[] memory uris = new string[](2);
        uris[0] = URI_ONE;
        uris[1] = URI_TWO;

        vm.prank(minter);
        uint256[] memory ids = certificate.batchMint(recipients, uris);

        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
        assertEq(certificate.ownerOf(1), participant);
        assertEq(certificate.ownerOf(2), participantTwo);
    }

    function testBatchMintRejectsLengthMismatch() public {
        address[] memory recipients = new address[](1);
        string[] memory uris = new string[](0);

        vm.prank(minter);
        vm.expectRevert(AvalancheBakeryCertificate.BatchLengthMismatch.selector);
        certificate.batchMint(recipients, uris);
    }

    function testBatchMintRejectsEmptyBatch() public {
        address[] memory recipients = new address[](0);
        string[] memory uris = new string[](0);

        vm.prank(minter);
        vm.expectRevert(AvalancheBakeryCertificate.EmptyBatch.selector);
        certificate.batchMint(recipients, uris);
    }

    function testBatchMintAllowsFifty() public {
        (address[] memory recipients, string[] memory uris) = _batchData(50);

        vm.prank(minter);
        uint256[] memory ids = certificate.batchMint(recipients, uris);

        assertEq(ids.length, 50);
        assertEq(ids[0], 1);
        assertEq(ids[49], 50);
        assertEq(certificate.nextTokenId(), 51);
    }

    function testBatchMintRejectsFiftyOne() public {
        (address[] memory recipients, string[] memory uris) = _batchData(51);

        vm.expectRevert(
            abi.encodeWithSelector(AvalancheBakeryCertificate.BatchTooLarge.selector, 51, certificate.MAX_BATCH_SIZE())
        );
        vm.prank(minter);
        certificate.batchMint(recipients, uris);
    }

    function testBatchWithDuplicateRecipientRollsBackCompletely() public {
        address[] memory recipients = new address[](2);
        recipients[0] = participant;
        recipients[1] = participant;
        string[] memory uris = new string[](2);
        uris[0] = URI_ONE;
        uris[1] = URI_TWO;

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBakeryCertificate.AlreadyIssued.selector, participant));
        certificate.batchMint(recipients, uris);

        assertFalse(certificate.hasBeenIssued(participant));
        assertEq(certificate.balanceOf(participant), 0);
        assertEq(certificate.nextTokenId(), 1);
    }

    function testBatchWithEmptyURIRollsBackCompletely() public {
        address[] memory recipients = new address[](2);
        recipients[0] = participant;
        recipients[1] = participantTwo;
        string[] memory uris = new string[](2);
        uris[0] = URI_ONE;
        uris[1] = "";

        vm.prank(minter);
        vm.expectRevert(AvalancheBakeryCertificate.EmptyTokenURI.selector);
        certificate.batchMint(recipients, uris);

        assertFalse(certificate.hasBeenIssued(participant));
        assertFalse(certificate.hasBeenIssued(participantTwo));
        assertEq(certificate.nextTokenId(), 1);
    }

    function testRecoveryRoleCanBurnAndBurnStateIsCorrect() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.prank(admin);
        certificate.adminBurn(tokenId);

        assertTrue(certificate.reissueAvailable(tokenId));
        assertTrue(certificate.hasBeenIssued(participant));
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, tokenId));
        certificate.ownerOf(tokenId);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, tokenId));
        certificate.locked(tokenId);
    }

    function testBurnEmitsCertificateRevoked() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.startPrank(admin);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit Transfer(participant, address(0), tokenId);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit CertificateRevoked(tokenId, participant);
        certificate.adminBurn(tokenId);
        vm.stopPrank();
    }

    function testUnauthorizedBurnReverts() public {
        uint256 tokenId = _mint(participant, URI_ONE);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, certificate.RECOVERY_ROLE()
            )
        );
        vm.prank(outsider);
        certificate.adminBurn(tokenId);
    }

    function testReissueToSameAddressSucceeds() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.prank(admin);
        uint256 newTokenId = certificate.reissue(burnedTokenId, participant, URI_TWO);

        assertEq(newTokenId, 2);
        assertNotEq(newTokenId, burnedTokenId);
        assertEq(certificate.ownerOf(newTokenId), participant);
        assertEq(certificate.tokenURI(newTokenId), URI_TWO);
        assertTrue(certificate.locked(newTokenId));
        assertFalse(certificate.reissueAvailable(burnedTokenId));
    }

    function testReissueToDifferentAddressSucceeds() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.prank(admin);
        uint256 newTokenId = certificate.reissue(burnedTokenId, participantTwo, URI_TWO);

        assertEq(certificate.ownerOf(newTokenId), participantTwo);
        assertTrue(certificate.hasBeenIssued(participantTwo));
    }

    function testReissueRejectsRecipientWhoAlreadyHoldsCertificate() public {
        uint256 burnedTokenId = _burnParticipant();
        _mint(participantTwo, URI_TWO);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(AvalancheBakeryCertificate.RecipientAlreadyHoldsCertificate.selector, participantTwo)
        );
        certificate.reissue(burnedTokenId, participantTwo, URI_ONE);

        assertTrue(certificate.reissueAvailable(burnedTokenId));
    }

    function testUnauthorizedReissueReverts() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, certificate.RECOVERY_ROLE()
            )
        );
        vm.prank(outsider);
        certificate.reissue(burnedTokenId, participantTwo, URI_TWO);
    }

    function testReissueWithoutBurnReverts() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBakeryCertificate.ReissueNotAvailable.selector, 1));
        certificate.reissue(1, participant, URI_ONE);
    }

    function testBurnedTokenCanOnlyBeUsedForOneReissue() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.prank(admin);
        certificate.reissue(burnedTokenId, participantTwo, URI_TWO);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBakeryCertificate.ReissueNotAvailable.selector, burnedTokenId));
        certificate.reissue(burnedTokenId, participant, URI_ONE);
    }

    function testReissuedTokenCanLaterStartItsOwnRecovery() public {
        uint256 burnedTokenId = _burnParticipant();
        vm.prank(admin);
        uint256 reissuedTokenId = certificate.reissue(burnedTokenId, participantTwo, URI_TWO);

        vm.prank(admin);
        certificate.adminBurn(reissuedTokenId);

        assertTrue(certificate.reissueAvailable(reissuedTokenId));
        vm.prank(admin);
        uint256 thirdTokenId = certificate.reissue(reissuedTokenId, participant, URI_ONE);
        assertEq(thirdTokenId, 3);
        assertEq(certificate.ownerOf(thirdTokenId), participant);
    }

    function testReissueRejectsZeroRecipient() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.prank(admin);
        vm.expectRevert(AvalancheBakeryCertificate.InvalidRecipient.selector);
        certificate.reissue(burnedTokenId, address(0), URI_ONE);

        assertTrue(certificate.reissueAvailable(burnedTokenId));
    }

    function testReissueRejectsEmptyURI() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.prank(admin);
        vm.expectRevert(AvalancheBakeryCertificate.EmptyTokenURI.selector);
        certificate.reissue(burnedTokenId, participant, "");

        assertTrue(certificate.reissueAvailable(burnedTokenId));
    }

    function testReissueEmitsLockedAndCertificateReissued() public {
        uint256 burnedTokenId = _burnParticipant();

        vm.startPrank(admin);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit Transfer(address(0), participantTwo, 2);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit MetadataUpdate(2);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit Locked(2);
        vm.expectEmit(true, true, true, true, address(certificate));
        emit CertificateReissued(burnedTokenId, 2, participantTwo, URI_TWO);
        certificate.reissue(burnedTokenId, participantTwo, URI_TWO);
        vm.stopPrank();
    }

    function testMintToContractWithoutReceiverRevertsAndRollsBack() public {
        NonReceiver recipient = new NonReceiver();

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(recipient)));
        certificate.mint(address(recipient), URI_ONE);

        assertFalse(certificate.hasBeenIssued(address(recipient)));
        assertEq(certificate.balanceOf(address(recipient)), 0);
        assertEq(certificate.nextTokenId(), 1);
    }

    function testFuzzBalanceCannotExceedOne(address recipient) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient.code.length == 0);

        uint256 firstBurnedTokenId = _mint(participant, URI_ONE);
        vm.prank(admin);
        certificate.adminBurn(firstBurnedTokenId);

        uint256 secondBurnedTokenId = _mint(participantTwo, URI_TWO);
        vm.prank(admin);
        certificate.adminBurn(secondBurnedTokenId);

        vm.prank(admin);
        certificate.reissue(firstBurnedTokenId, recipient, URI_ONE);
        assertEq(certificate.balanceOf(recipient), 1);

        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(AvalancheBakeryCertificate.RecipientAlreadyHoldsCertificate.selector, recipient)
        );
        certificate.reissue(secondBurnedTokenId, recipient, URI_TWO);
        assertEq(certificate.balanceOf(recipient), 1);
    }

    function testFuzzSecondOrdinaryMintAlwaysReverts(address recipient, string calldata metadataURI) public {
        vm.assume(recipient != address(0));
        vm.assume(recipient.code.length == 0);
        vm.assume(bytes(metadataURI).length != 0);

        _mint(recipient, metadataURI);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBakeryCertificate.AlreadyIssued.selector, recipient));
        certificate.mint(recipient, URI_TWO);
        assertEq(certificate.balanceOf(recipient), 1);
    }

    function testRevertingReceiverInBatchRollsBackEntireBatch() public {
        RevertingReceiver revertingReceiver = new RevertingReceiver();
        address[] memory recipients = new address[](3);
        recipients[0] = participant;
        recipients[1] = address(revertingReceiver);
        recipients[2] = participantTwo;
        string[] memory uris = new string[](3);
        uris[0] = URI_ONE;
        uris[1] = URI_ONE;
        uris[2] = URI_TWO;

        vm.prank(minter);
        vm.expectRevert(bytes("receiver rejected token"));
        certificate.batchMint(recipients, uris);

        assertEq(certificate.nextTokenId(), 1);
        assertFalse(certificate.hasBeenIssued(participant));
        assertFalse(certificate.hasBeenIssued(address(revertingReceiver)));
        assertFalse(certificate.hasBeenIssued(participantTwo));
    }

    function testPreviouslyIssuedRecipientInLaterBatchRollsBackNewEntries() public {
        address[] memory firstRecipients = new address[](1);
        firstRecipients[0] = participant;
        string[] memory firstUris = new string[](1);
        firstUris[0] = URI_ONE;
        vm.prank(minter);
        certificate.batchMint(firstRecipients, firstUris);

        address[] memory secondRecipients = new address[](2);
        secondRecipients[0] = participantTwo;
        secondRecipients[1] = participant;
        string[] memory secondUris = new string[](2);
        secondUris[0] = URI_TWO;
        secondUris[1] = URI_ONE;

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AvalancheBakeryCertificate.AlreadyIssued.selector, participant));
        certificate.batchMint(secondRecipients, secondUris);

        assertEq(certificate.nextTokenId(), 2);
        assertEq(certificate.ownerOf(1), participant);
        assertFalse(certificate.hasBeenIssued(participantTwo));
        assertEq(certificate.balanceOf(participantTwo), 0);
    }

    function testZeroRecipientInBatchRollsBackEntireBatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = participant;
        recipients[1] = address(0);
        string[] memory uris = new string[](2);
        uris[0] = URI_ONE;
        uris[1] = URI_TWO;

        vm.prank(minter);
        vm.expectRevert(AvalancheBakeryCertificate.InvalidRecipient.selector);
        certificate.batchMint(recipients, uris);

        assertEq(certificate.nextTokenId(), 1);
        assertFalse(certificate.hasBeenIssued(participant));
    }

    function testAdminCanGrantAndRevokeRole() public {
        vm.prank(admin);
        certificate.grantRole(minterRole, outsider);
        assertTrue(certificate.hasRole(minterRole, outsider));

        vm.prank(admin);
        certificate.revokeRole(minterRole, outsider);
        assertFalse(certificate.hasRole(minterRole, outsider));
    }

    function testRoleHolderCanRenounceOwnRole() public {
        vm.prank(admin);
        certificate.grantRole(minterRole, outsider);

        vm.prank(outsider);
        certificate.renounceRole(minterRole, outsider);
        assertFalse(certificate.hasRole(minterRole, outsider));
    }

    function testUnauthorizedAccountCannotGrantOrRevokeRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, defaultAdminRole)
        );
        vm.prank(outsider);
        certificate.grantRole(minterRole, outsider);

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, defaultAdminRole)
        );
        vm.prank(outsider);
        certificate.revokeRole(recoveryRole, admin);
    }

    function testAccountCannotRenounceRoleForAnotherAccount() public {
        vm.expectRevert(IAccessControl.AccessControlBadConfirmation.selector);
        vm.prank(outsider);
        certificate.renounceRole(recoveryRole, admin);
    }

    function testAdminBurnRejectsNonexistentToken() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 999));
        certificate.adminBurn(999);
    }

    function _mint(address recipient, string memory uri) internal returns (uint256 tokenId) {
        vm.prank(minter);
        tokenId = certificate.mint(recipient, uri);
    }

    function _burnParticipant() internal returns (uint256 tokenId) {
        tokenId = _mint(participant, URI_ONE);
        vm.prank(admin);
        certificate.adminBurn(tokenId);
    }

    function _batchData(uint256 length) internal pure returns (address[] memory recipients, string[] memory uris) {
        recipients = new address[](length);
        uris = new string[](length);
        for (uint256 i; i < length; ++i) {
            recipients[i] = vm.addr(i + 100);
            uris[i] = URI_ONE;
        }
    }
}

contract DeployTest is Test {
    Deploy internal deployer;
    address internal admin = makeAddr("deployAdmin");
    address internal minter = makeAddr("deployMinter");

    function setUp() public {
        deployer = new Deploy();
        // forge-lint: disable-next-line(unsafe-cheatcode)
        vm.setEnv("PRIVATE_KEY", "1");
        // forge-lint: disable-next-line(unsafe-cheatcode)
        vm.setEnv("ADMIN_ADDRESS", vm.toString(admin));
        // forge-lint: disable-next-line(unsafe-cheatcode)
        vm.setEnv("MINTER_ADDRESS", vm.toString(minter));
    }

    function testDeployRejectsUnsupportedChain() public {
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(Deploy.UnsupportedChain.selector, 1));
        deployer.run();
    }

    function testDeploySucceedsOnFujiAndVerifiesRoles() public {
        vm.chainId(43113);
        AvalancheBakeryCertificate deployed = deployer.run();

        assertTrue(deployed.hasRole(deployed.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(deployed.hasRole(deployed.RECOVERY_ROLE(), admin));
        assertTrue(deployed.hasRole(deployed.MINTER_ROLE(), minter));
    }

    function testDeploySucceedsOnMainnetAndVerifiesRoles() public {
        vm.chainId(43114);
        AvalancheBakeryCertificate deployed = deployer.run();

        assertTrue(deployed.hasRole(deployed.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(deployed.hasRole(deployed.RECOVERY_ROLE(), admin));
        assertTrue(deployed.hasRole(deployed.MINTER_ROLE(), minter));
    }
}
