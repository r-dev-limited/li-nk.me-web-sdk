export class FetchHttpClient {
    constructor(fetchImpl) {
        this.fetchImpl = fetchImpl;
    }
    request(input, init) {
        return this.fetchImpl(input, init);
    }
}
export async function requestJson(client, input, init) {
    const res = await client.request(input, init);
    let data = null;
    try {
        data = await res.json();
    }
    catch {
        data = null;
    }
    return { ok: res.ok, status: res.status, data };
}
//# sourceMappingURL=httpClient.js.map