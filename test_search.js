import https from 'https';

https.get('https://job.gg.go.kr/pblcEmpmn/list.do', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/<input[^>]*name=["']([^"']+)["'][^>]*>/ig);
    if(matches) {
       console.log(matches.filter(m => m.includes('type="text"') || m.includes('hidden') || m.includes('search')));
    } else {
       console.log("No inputs found");
    }
  });
});
