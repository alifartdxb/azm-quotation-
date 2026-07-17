sed -i 's/sku: '"'"''"'"', name: '"'"''"'"', brand: '"'"''"'"', price: 0, unit: '"'"'Pcs'"'"', category: '"'"''"'"', image: '"'"''"'"'/sku: '"'"''"'"', name: '"'"''"'"', brand: '"'"''"'"', price: 0, unit: '"'"'Sqm'"'"', category: '"'"''"'"', image: '"'"''"'"'/g' src/pages/Products.tsx

sed -i 's/<option value="Pcs">Pcs<\/option>/<option value="Sqm">Sqm<\/option>\n                     <option value="Pcs">Pcs<\/option>/g' src/pages/Products.tsx
sed -i 's/<option value="Sqm">Sqm<\/option>\n                     <option value="Pcs">Pcs<\/option>\n                     <option value="Sqm">Sqm<\/option>/<option value="Sqm">Sqm<\/option>\n                     <option value="Pcs">Pcs<\/option>/g' src/pages/Products.tsx
