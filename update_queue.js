
const fs = require('fs');
let content = fs.readFileSync('frontend/src/app/pages/queue.component.ts', 'utf8');

content = content.replace(/'action\.start_drafting' \| translate/g, "getActionLabel(r.transactionType, 'start_drafting') | translate");
content = content.replace(/'action\.start_checking' \| translate/g, "getActionLabel(r.transactionType, 'start_checking') | translate");
content = content.replace(/'timeline\.received' \| translate/g, "getTimelineLabel(r ? r.transactionType : selectedLc?.transactionType, 'received') | translate");
content = content.replace(/'timeline\.drafting' \| translate/g, "getTimelineLabel(r ? r.transactionType : selectedLc?.transactionType, 'drafting') | translate");
content = content.replace(/'timeline\.checking' \| translate/g, "getTimelineLabel(r ? r.transactionType : selectedLc?.transactionType, 'checking') | translate");
content = content.replace(/'timeline\.released' \| translate/g, "getTimelineLabel(r ? r.transactionType : selectedLc?.transactionType, 'released') | translate");

fs.writeFileSync('frontend/src/app/pages/queue.component.ts', content, 'utf8');

