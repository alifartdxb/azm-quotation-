sed -i "s/return get(\/databases\/\$(database)\/documents\/users\/\$(request.auth.uid)).data.role;/let userPath = \/databases\/\$(database)\/documents\/users\/\$(request.auth.uid);\n      return exists(userPath) ? get(userPath).data.get('role', 'VIEWER') : 'VIEWER';/g" firestore.rules

sed -i "s/let doc = get(\/databases\/\$(database)\/documents\/users\/\$(request.auth.uid));/let userPath = \/databases\/\$(database)\/documents\/users\/\$(request.auth.uid);/g" firestore.rules
sed -i "s/return (doc != null && doc.data.companyId != null) ? doc.data.companyId : 'company_001';/return exists(userPath) ? get(userPath).data.get('companyId', 'company_001') : 'company_001';/g" firestore.rules
