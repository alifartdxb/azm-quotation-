const fs = require('fs');
let code = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

code = code.replace(
  /value={editCustomer\.name}/g,
  "value={editCustomer.companyName || editCustomer.customerName}"
);

code = code.replace(
  /onChange={e => setEditCustomer\(prev => \(\{ \.\.\.prev, name: e\.target\.value \}\)\)}/g,
  "onChange={e => setEditCustomer(prev => ({ ...prev, companyName: e.target.value, customerName: e.target.value }))}"
);

fs.writeFileSync('src/pages/Customers.tsx', code);
