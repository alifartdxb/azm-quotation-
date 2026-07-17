sed -i "s/unit: newProduct.unit || 'Pcs',/unit: newProduct.unit || 'Sqm',/g" src/pages/Products.tsx
sed -i "s/unit: row.unit || row.Unit || 'Pcs',/unit: row.unit || row.Unit || 'Sqm',/g" src/pages/Products.tsx
