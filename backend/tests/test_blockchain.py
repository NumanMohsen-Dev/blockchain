def test_blockchain_status_endpoint(client):
    resp = client.get("/api/blockchain/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "connected" in data
    assert "rpc_url" in data
    assert "contract_accessible" in data
    assert isinstance(data["connected"], bool)
    assert isinstance(data["contract_accessible"], bool)

