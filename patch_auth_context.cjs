const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

const injection = `
              // Optionally mirror to tenant users for UI consistency if needed
              if (companyId && companyId !== 'company_001') {
                await setDoc(doc(db, 'companies', companyId, 'users', firebaseUser.uid), {
                  email: firebaseUser.email,
                  role: role,
                  name: name,
                  companyId: companyId,
                  createdAt: new Date().toISOString()
                });
              }

              // Initialize company settings if registering a new company
              if (regData && regData.company) {
                const regCompany = regData.company;
                
                await setDoc(doc(db, 'companies', companyId), {
                   name: regCompany.name,
                   tradeLicense: regCompany.tradeLicense,
                   trn: regCompany.trn,
                   type: regCompany.businessType,
                   country: regCompany.country,
                   emirate: regCompany.emirate,
                   status: 'active',
                   createdAt: new Date().toISOString()
                });
                
                await setDoc(doc(db, 'companies', companyId, 'settings', 'company'), {
                   companyNameEn: regCompany.name,
                   companyNameAr: '',
                   email: regCompany.email,
                   phone: regCompany.phone,
                   whatsapp: regCompany.whatsapp,
                   trn: regCompany.trn,
                   website: regCompany.website,
                   address: regCompany.address
                });
                
                await setDoc(doc(db, 'companies', companyId, 'settings', 'branding'), {
                   headerImage: '',
                   footerImage: '',
                   companyStamp: '',
                   showStampInPdf: true,
                   showStampInPreview: true,
                   showStampOnLastPageOnly: true
                });
                
                await setDoc(doc(db, 'companies', companyId, 'counters', 'quotationCounter'), {
                   currentNumber: 1,
                   prefix: 'QTN',
                   year: new Date().getFullYear()
                });
                
                await setDoc(doc(db, 'companies', companyId, 'counters', 'invoiceCounter'), {
                   currentNumber: 1,
                   prefix: 'INV',
                   year: new Date().getFullYear()
                });
              }
`;

code = code.replace(
  /\/\/ Optionally mirror to tenant users for UI consistency if needed[\s\S]*?createdAt: new Date\(\)\.toISOString\(\)\n                \}\);\n              \}/,
  injection.trim()
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
