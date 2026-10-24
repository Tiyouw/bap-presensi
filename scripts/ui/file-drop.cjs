exports.dropFile = async (page, label, file) => {
  const target = page.locator('.file-drop-field').filter({has:page.getByLabel(label,{exact:true})}).locator('.file-drop');
  const transfer = await page.evaluateHandle(({name,type,bytes})=>{
    const data = new DataTransfer();data.items.add(new File([new Uint8Array(bytes)],name,{type}));return data;
  }, {name:file.name,type:file.mimeType,bytes:[...file.buffer]});
  await target.dispatchEvent('drop',{dataTransfer:transfer});
  await transfer.dispose();
};
