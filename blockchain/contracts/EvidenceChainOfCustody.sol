// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EvidenceChainOfCustody
 * @notice Immutable digital evidence chain-of-custody ledger.
 * Records evidence registration with SHA-256 hash digests, tracks custodianship transfers,
 * and enables tamper-evident integrity verification.
 */
contract EvidenceChainOfCustody {
    address public owner;

    struct CustodyTransfer {
        address previousCustodian;
        address newCustodian;
        uint256 timestamp;
        string reason;
    }

    struct EvidenceRecord {
        string evidenceId;
        bytes32 fileHash;
        uint256 registrationTimestamp;
        address initialCustodian;
        address currentCustodian;
        bool exists;
    }

    // Mapping from evidenceId string to EvidenceRecord
    mapping(string => EvidenceRecord) private _evidenceRecords;

    // Mapping from evidenceId to array of CustodyTransfer events
    mapping(string => CustodyTransfer[]) private _custodyHistories;

    // Authorized relayers who can submit transactions on behalf of users (educational backend relayer)
    mapping(address => bool) public authorizedRelayers;

    // Events
    event EvidenceRegistered(
        string indexed evidenceIdIndex,
        string evidenceId,
        bytes32 fileHash,
        address indexed initialCustodian,
        uint256 timestamp
    );

    event CustodyTransferred(
        string indexed evidenceIdIndex,
        string evidenceId,
        address indexed previousCustodian,
        address indexed newCustodian,
        uint256 timestamp,
        string reason
    );

    event RelayerStatusUpdated(address indexed relayer, bool isAuthorized);

    // Custom Errors
    error EmptyEvidenceId();
    error InvalidFileHash();
    error InvalidCustodianAddress();
    error EvidenceAlreadyExists(string evidenceId);
    error EvidenceNotFound(string evidenceId);
    error NotCurrentCustodian(address caller, address currentCustodian);
    error CustodianCannotBeSame();
    error EmptyTransferReason();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedRelayers[msg.sender] = true;
    }

    /**
     * @notice Set authorization for a backend relayer account
     */
    function setRelayer(address relayer, bool authorized) external onlyOwner {
        if (relayer == address(0)) revert InvalidCustodianAddress();
        authorizedRelayers[relayer] = authorized;
        emit RelayerStatusUpdated(relayer, authorized);
    }

    /**
     * @notice Registers a new evidence item with its unique ID and SHA-256 digest
     * @param evidenceId Unique identifier for the evidence
     * @param fileHash SHA-256 hash of the evidence file (32 bytes)
     * @param initialCustodian Address of the initial custodian
     */
    function registerEvidence(
        string calldata evidenceId,
        bytes32 fileHash,
        address initialCustodian
    ) external {
        if (bytes(evidenceId).length == 0) revert EmptyEvidenceId();
        if (fileHash == bytes32(0)) revert InvalidFileHash();
        if (initialCustodian == address(0)) revert InvalidCustodianAddress();
        if (_evidenceRecords[evidenceId].exists) revert EvidenceAlreadyExists(evidenceId);

        _evidenceRecords[evidenceId] = EvidenceRecord({
            evidenceId: evidenceId,
            fileHash: fileHash,
            registrationTimestamp: block.timestamp,
            initialCustodian: initialCustodian,
            currentCustodian: initialCustodian,
            exists: true
        });

        // Record initial custody creation in history
        _custodyHistories[evidenceId].push(CustodyTransfer({
            previousCustodian: address(0),
            newCustodian: initialCustodian,
            timestamp: block.timestamp,
            reason: "Initial registration"
        }));

        emit EvidenceRegistered(
            evidenceId,
            evidenceId,
            fileHash,
            initialCustodian,
            block.timestamp
        );
    }

    /**
     * @notice Transfers custody of an evidence item to a new custodian
     * @param evidenceId The unique evidence identifier
     * @param newCustodian Address of the receiving custodian
     * @param reason Documented justification for the transfer
     */
    function transferCustody(
        string calldata evidenceId,
        address newCustodian,
        string calldata reason
    ) external {
        EvidenceRecord storage record = _evidenceRecords[evidenceId];
        if (!record.exists) revert EvidenceNotFound(evidenceId);
        if (newCustodian == address(0)) revert InvalidCustodianAddress();
        if (newCustodian == record.currentCustodian) revert CustodianCannotBeSame();
        if (bytes(reason).length == 0) revert EmptyTransferReason();

        // Sender must either be the current custodian or an authorized relayer/owner
        if (msg.sender != record.currentCustodian && !authorizedRelayers[msg.sender]) {
            revert NotCurrentCustodian(msg.sender, record.currentCustodian);
        }

        address previousCustodian = record.currentCustodian;
        record.currentCustodian = newCustodian;

        _custodyHistories[evidenceId].push(CustodyTransfer({
            previousCustodian: previousCustodian,
            newCustodian: newCustodian,
            timestamp: block.timestamp,
            reason: reason
        }));

        emit CustodyTransferred(
            evidenceId,
            evidenceId,
            previousCustodian,
            newCustodian,
            block.timestamp,
            reason
        );
    }

    /**
     * @notice Explicit transfer by an authorized relayer specifying previous custodian for extra verification
     */
    function transferCustodyByRelayer(
        string calldata evidenceId,
        address expectedCurrentCustodian,
        address newCustodian,
        string calldata reason
    ) external {
        if (!authorizedRelayers[msg.sender]) revert Unauthorized();
        EvidenceRecord storage record = _evidenceRecords[evidenceId];
        if (!record.exists) revert EvidenceNotFound(evidenceId);
        if (record.currentCustodian != expectedCurrentCustodian) {
            revert NotCurrentCustodian(expectedCurrentCustodian, record.currentCustodian);
        }
        if (newCustodian == address(0)) revert InvalidCustodianAddress();
        if (newCustodian == record.currentCustodian) revert CustodianCannotBeSame();
        if (bytes(reason).length == 0) revert EmptyTransferReason();

        address previousCustodian = record.currentCustodian;
        record.currentCustodian = newCustodian;

        _custodyHistories[evidenceId].push(CustodyTransfer({
            previousCustodian: previousCustodian,
            newCustodian: newCustodian,
            timestamp: block.timestamp,
            reason: reason
        }));

        emit CustodyTransferred(
            evidenceId,
            evidenceId,
            previousCustodian,
            newCustodian,
            block.timestamp,
            reason
        );
    }

    /**
     * @notice Retrieves the immutable evidence record
     * @param evidenceId The unique evidence identifier
     */
    function getEvidence(string calldata evidenceId)
        external
        view
        returns (
            bytes32 fileHash,
            uint256 registrationTimestamp,
            address initialCustodian,
            address currentCustodian,
            bool exists
        )
    {
        EvidenceRecord storage record = _evidenceRecords[evidenceId];
        if (!record.exists) revert EvidenceNotFound(evidenceId);
        return (
            record.fileHash,
            record.registrationTimestamp,
            record.initialCustodian,
            record.currentCustodian,
            record.exists
        );
    }

    /**
     * @notice Retrieves full chronological custody transfer history for an evidence item
     * @param evidenceId The unique evidence identifier
     */
    function getCustodyHistory(string calldata evidenceId)
        external
        view
        returns (CustodyTransfer[] memory)
    {
        if (!_evidenceRecords[evidenceId].exists) revert EvidenceNotFound(evidenceId);
        return _custodyHistories[evidenceId];
    }

    /**
     * @notice Verifies whether a supplied SHA-256 hash matches the recorded original hash
     * @param evidenceId The unique evidence identifier
     * @param suppliedHash The hash to compare against the ledger
     */
    function verifyEvidenceRecord(string calldata evidenceId, bytes32 suppliedHash)
        external
        view
        returns (bool matches, bytes32 originalHash)
    {
        EvidenceRecord storage record = _evidenceRecords[evidenceId];
        if (!record.exists) revert EvidenceNotFound(evidenceId);
        return (record.fileHash == suppliedHash, record.fileHash);
    }

    /**
     * @notice Checks if a given address is the current custodian
     * @param evidenceId The unique evidence identifier
     * @param checkAddress The address to test
     */
    function isCurrentCustodian(string calldata evidenceId, address checkAddress)
        external
        view
        returns (bool)
    {
        EvidenceRecord storage record = _evidenceRecords[evidenceId];
        if (!record.exists) return false;
        return record.currentCustodian == checkAddress;
    }
}
