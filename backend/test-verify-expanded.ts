async function test() {
  console.log('Fetching sports data...');
  const response = await fetch('http://localhost:3001/api/sports-data?reload=true');
  const data = await response.json();
  console.log('Sports Data:', JSON.stringify(data, null, 2));
}

test();
