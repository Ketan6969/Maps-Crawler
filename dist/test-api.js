"use strict";
async function runTests() {
    console.log("Starting Rigorous API Tests...\n");
    const baseUrl = 'http://localhost:3000';
    // Helper
    const hitSearch = async (query, limit) => {
        const body = limit ? { query, limit } : { query };
        try {
            const start = Date.now();
            const res = await fetch(`${baseUrl}/maps/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            const time = ((Date.now() - start) / 1000).toFixed(2);
            return { status: res.status, time, data };
        }
        catch (e) {
            return { error: e.message };
        }
    };
    // Test 1: Invalid payload
    console.log("➔ Test 1: Missing Query Payload");
    let res = await hitSearch("");
    console.log(res.status === 400 ? "✅ Passed (400 Bad Request)" : `❌ Failed: Status ${res.status}`);
    // Test 2: Invalid limit
    console.log("\n➔ Test 2: Invalid Limit (e.g. limit: 'abc' or -5)");
    res = await hitSearch("pizza", -5);
    console.log(res.status === 400 ? `✅ Passed (400 Bad Request)` : `❌ Failed. Limit validation issue? Status: ${res.status}`);
    // Test 3: Meaningless query that yields no results
    console.log("\n➔ Test 3: Gibberish Query (Testing empty state handling)");
    res = await hitSearch("asdfqwertyzxcvbnm12345 in middle of ocean", 2);
    if (res.status === 200 && res.data.results?.length === 0) {
        console.log("✅ Passed (Returned empty array gracefully)");
    }
    else {
        console.log(`❌ Failed. Status: ${res.status}, Data:`, res.data);
    }
    // Test 4: Concurrency (2 requests at once)
    console.log("\n➔ Test 4: Concurrency (2 parallel requests for completely different things)");
    const p1 = hitSearch("plumber in New York, NY", 2);
    const p2 = hitSearch("gym in London, UK", 2);
    const [res1, res2] = await Promise.all([p1, p2]);
    console.log(`Req 1: Status ${res1.status}, Items: ${res1.data?.results?.length ?? 'none'}, Time: ${res1.time}s`);
    console.log(`Req 2: Status ${res2.status}, Items: ${res2.data?.results?.length ?? 'none'}, Time: ${res2.time}s`);
    if (res1.status === 200 && res2.status === 200) {
        console.log("✅ Passed (Handled concurrency fine)");
    }
    else {
        console.log("❌ Failed concurrency");
    }
    console.log("\nTests Complete.");
}
runTests();
