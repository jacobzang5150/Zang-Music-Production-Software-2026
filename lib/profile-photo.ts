// Decode and redraw a center crop before storing it in the private studio profile.
export async function profilePhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>16*1024*1024)throw Error('Choose a JPG, PNG, or WebP under 16 MB.');
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing unavailable.');
 const side=Math.min(image.naturalWidth,image.naturalHeight);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,192,192);
 ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,192,192);
 return canvas.toDataURL('image/jpeg',0.82);
 }catch{throw Error('Could not open that picture. Try another image.')}finally{URL.revokeObjectURL(url)}
}
