// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

import {IERC5192} from "./interfaces/IERC5192.sol";

/// @title Avalanche Bakery Certificate
/// @notice A permanently locked EIP-5192 participation certificate. Recovery-role
/// operators may revoke a certificate and reissue it to a recovery wallet.
contract AvalancheBakeryCertificate is ERC721URIStorage, AccessControl, IERC5192 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");
    uint256 public constant MAX_BATCH_SIZE = 50;

    mapping(address recipient => bool issued) public hasBeenIssued;
    mapping(uint256 burnedTokenId => bool available) public reissueAvailable;

    uint256 private _nextTokenId = 1;

    error InvalidAdmin();
    error InvalidMinter();
    error InvalidRecipient();
    error EmptyTokenURI();
    error AlreadyIssued(address recipient);
    error BatchLengthMismatch();
    error EmptyBatch();
    error BatchTooLarge(uint256 supplied, uint256 maximum);
    error ReissueNotAvailable(uint256 burnedTokenId);
    error RecipientAlreadyHoldsCertificate(address recipient);
    error SoulboundTransferNotAllowed();
    error SoulboundApprovalNotAllowed();

    event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string tokenURI);
    event CertificateRevoked(uint256 indexed tokenId, address indexed holder);
    event CertificateReissued(
        uint256 indexed burnedTokenId, uint256 indexed newTokenId, address indexed recipient, string tokenURI
    );

    /// @notice Configures distinct administration/recovery and server-minting roles.
    /// @param admin Address receiving DEFAULT_ADMIN_ROLE and RECOVERY_ROLE.
    /// @param initialMinter Address receiving only MINTER_ROLE.
    constructor(address admin, address initialMinter) ERC721("Avalanche Bakery Certificate", "ABAKE") {
        if (admin == address(0)) revert InvalidAdmin();
        if (initialMinter == address(0)) revert InvalidMinter();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RECOVERY_ROLE, admin);
        _grantRole(MINTER_ROLE, initialMinter);
    }

    /// @notice Returns the ID that will be assigned by the next successful issuance.
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Issues a participant's first certificate.
    /// @dev A recipient remains marked as issued even after revocation.
    function mint(address recipient, string calldata metadataURI)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        tokenId = _mintCertificate(recipient, metadataURI);
    }

    /// @notice Atomically issues between one and fifty first certificates.
    /// @dev Any invalid entry reverts the entire batch.
    function batchMint(address[] calldata recipients, string[] calldata metadataUris)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256[] memory tokenIds)
    {
        uint256 length = recipients.length;
        if (length != metadataUris.length) revert BatchLengthMismatch();
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge(length, MAX_BATCH_SIZE);

        tokenIds = new uint256[](length);
        for (uint256 i; i < length; ++i) {
            tokenIds[i] = _mintCertificate(recipients[i], metadataUris[i]);
        }
    }

    /// @notice Revokes an existing certificate and enables one reissue from its ID.
    /// @dev Only RECOVERY_ROLE may revoke; certificate holders cannot burn directly.
    function adminBurn(uint256 tokenId) external onlyRole(RECOVERY_ROLE) {
        address holder = ownerOf(tokenId);
        _burn(tokenId);
        reissueAvailable[tokenId] = true;
        emit CertificateRevoked(tokenId, holder);
    }

    /// @notice Consumes a revoked token's one-time recovery right and creates a new token ID.
    /// @dev Prior issuance history does not block recovery, but the recipient must hold no certificate.
    function reissue(uint256 burnedTokenId, address recipient, string calldata metadataURI)
        external
        onlyRole(RECOVERY_ROLE)
        returns (uint256 newTokenId)
    {
        if (!reissueAvailable[burnedTokenId]) revert ReissueNotAvailable(burnedTokenId);
        _validateRecipientAndUri(recipient, metadataURI);
        if (balanceOf(recipient) != 0) revert RecipientAlreadyHoldsCertificate(recipient);

        reissueAvailable[burnedTokenId] = false;
        hasBeenIssued[recipient] = true;
        newTokenId = _issue(recipient, metadataURI);

        emit CertificateReissued(burnedTokenId, newTokenId, recipient, metadataURI);
    }

    /// @inheritdoc IERC5192
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /// @notice Approvals are disabled because certificates cannot be transferred.
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert SoulboundApprovalNotAllowed();
    }

    /// @notice Operator approvals are disabled because certificates cannot be transferred.
    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert SoulboundApprovalNotAllowed();
    }

    /// @inheritdoc ERC721URIStorage
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    function _mintCertificate(address recipient, string calldata metadataURI) private returns (uint256 tokenId) {
        _validateRecipientAndUri(recipient, metadataURI);
        if (hasBeenIssued[recipient]) revert AlreadyIssued(recipient);

        hasBeenIssued[recipient] = true;
        tokenId = _issue(recipient, metadataURI);
        emit CertificateIssued(tokenId, recipient, metadataURI);
    }

    function _issue(address recipient, string calldata metadataURI) private returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        ++_nextTokenId;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI);
        emit Locked(tokenId);
    }

    function _validateRecipientAndUri(address recipient, string calldata metadataURI) private pure {
        if (recipient == address(0)) revert InvalidRecipient();
        if (bytes(metadataURI).length == 0) revert EmptyTokenURI();
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundTransferNotAllowed();
        return super._update(to, tokenId, auth);
    }
}
