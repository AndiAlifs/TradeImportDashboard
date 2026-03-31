
const fs = require('fs');
let content = fs.readFileSync('frontend/src/app/utils/stage-duration.ts', 'utf8');

content = content.replace(/'chart\.inbox'/g, 'getChartLabel(record?.transactionType, \'inbox\')');
content = content.replace(/'chart\.drafting'/g, 'getChartLabel(record?.transactionType, \'drafting\')');
content = content.replace(/'chart\.checking'/g, 'getChartLabel(record?.transactionType, \'checking\')');

fs.writeFileSync('frontend/src/app/utils/stage-duration.ts', content, 'utf8');

