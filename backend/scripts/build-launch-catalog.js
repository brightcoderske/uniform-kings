import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const template=JSON.parse(await readFile(new URL("../catalog-import.example.json",import.meta.url),"utf8"));
const output=process.argv[2] || "catalog-import.local.json";
const imageDirectory=path.resolve("uploads/catalog-launch");
await mkdir(imageDirectory,{recursive:true});
const slugify=(value)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const wait=(milliseconds)=>new Promise((resolve)=>setTimeout(resolve,milliseconds));
const products=[];
let completed=[];
try{completed=JSON.parse(await readFile(output,"utf8")).products || [];}catch{}
const add=(category,names,defaults={})=>names.forEach((name)=>products.push({name,category_slug:category,product_type:defaults.product_type || name,brand:"Uniform Kings",gender:defaults.gender || "Unisex",age_group:defaults.age_group || "Kids",material:defaults.material || null,sizes:defaults.sizes || [],colours:defaults.colours || [],image_query:`${name} ${defaults.image_query || "Kenya"}`}));

add("school-uniforms",["Boys Short Sleeve School Shirt","Boys Long Sleeve School Shirt","Girls Short Sleeve School Blouse","Girls Long Sleeve School Blouse","Unisex Short Sleeve School Shirt","Unisex Long Sleeve School Shirt"],{material:"Cotton blend",sizes:["22","24","26","28","30","32","34","36","38","40","42"],colours:["White","Sky Blue","Cream"]});
add("school-uniforms",["Boys Flat Front School Trousers","Boys Pleated School Trousers","Boys Elastic Waist School Trousers","Girls Straight Leg School Trousers","Senior School Formal Trousers","Junior School Pull-On Trousers"],{material:"Poly-viscose",gender:"Unisex",sizes:["22","24","26","28","30","32","34","36","38","40","42"],colours:["Grey","Navy","Black","Khaki"]});
add("school-uniforms",["Pleated School Skirt","Box Pleat School Skirt","Knife Pleat School Skirt","A-Line School Skirt","Senior School Straight Skirt"],{material:"Poly-viscose",gender:"Girls",sizes:["22","24","26","28","30","32","34","36","38","40"],colours:["Grey","Navy","Black","Maroon","Green"]});
add("school-uniforms",["Checked School Dress","Striped School Dress","Junior School Pinafore","Pleated School Pinafore","Senior School Tunic Dress"],{material:"Cotton blend",gender:"Girls",sizes:["22","24","26","28","30","32","34","36","38"],colours:["Blue","Green","Maroon","Purple","Brown"]});
add("school-uniforms",["V-Neck School Sweater","Round Neck School Sweater","School Cardigan","Sleeveless School Pullover","School Fleece Jacket","Zip-Up School Sweater","Primary School Jersey","Senior School Jersey"],{material:"Acrylic knit",sizes:["22","24","26","28","30","32","34","36","38","40","42"],colours:["Navy","Royal Blue","Maroon","Bottle Green","Grey","Black"]});
add("school-uniforms",["Boys School Blazer","Girls School Blazer","Unisex School Blazer","Prefect School Blazer"],{material:"Poly-viscose",sizes:["24","26","28","30","32","34","36","38","40","42","44"],colours:["Navy","Royal Blue","Maroon","Bottle Green","Black"]});
add("sports-pe-wear",["School Tracksuit Set","School Track Jacket","School Track Pants","PE T-Shirt","PE Polo Shirt","PE Sports Shorts","School Football Jersey","School Basketball Jersey","School Rugby Jersey","Athletics Running Vest","Athletics Running Shorts","School Sports Skirt","School Sports Skort","School Swimwear","School Sports Socks"],{material:"Performance polyester",sizes:["24","26","28","30","32","34","36","38","40","42"],colours:["Navy","Royal Blue","Red","Green","Black","White"]});
add("footwear-shoe-care",["Boys Lace-Up Leather School Shoes","Boys Touch-Fastening School Shoes","Boys Slip-On School Shoes","Girls Strap School Shoes","Girls Lace-Up School Shoes","Girls Slip-On School Shoes","Unisex Black School Shoes","White School Sports Shoes","Black School Sports Shoes","Running Sports Shoes","School Sandals","School Gumboots","Leather Shoe Polish","School Shoe Brush","Replacement School Shoe Laces"],{material:"Mixed materials",sizes:["24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","43"],colours:["Black","Brown","White"],image_query:"school shoes"});
add("bags-school-essentials",["Junior School Backpack","Senior School Backpack","Wheeled School Bag","Waterproof School Backpack","Reflective School Backpack","School Lunch Bag","Insulated Lunch Bag","Pencil Pouch","Double-Zip Pencil Case","Stainless Steel Water Bottle","Plastic School Water Bottle","Insulated Water Bottle","School Lunch Box","Geometry Set Case","Art Supplies Bag"],{material:"Mixed materials",sizes:["Standard"],colours:["Navy","Black","Blue","Red","Pink","Purple","Green"],image_query:"school backpack"});
add("uniform-accessories",["Knee-High School Socks","Ankle School Socks","Sports Crew Socks","School Bow Tie","Striped School Tie","Plain School Tie","Elastic School Belt","Leather School Belt","Cotton Handkerchief Set","School Badge Holder","Iron-On Name Labels","Sew-On Name Labels","Sewing Thread Set","Uniform Repair Sewing Kit","Replacement Uniform Buttons"],{material:"Mixed materials",sizes:["Small","Medium","Large"],colours:["White","Grey","Navy","Black","Maroon","Green"],image_query:"school uniform accessories"});
add("bedding-nightwear",["Single School Bedsheet Set","Single Fitted School Bedsheet","School Duvet Cover Set","School Pillowcase Pair","School Fleece Blanket","School Cotton Blanket","School Bath Towel","School Face Towel","Boys Cotton Pyjamas","Girls Cotton Pyjamas"],{material:"Cotton blend",sizes:["Single","Standard"],colours:["White","Blue","Grey","Navy","Pink","Cream"],image_query:"bedding"});
add("professional-healthcare-wear",["Unisex Medical Scrub Set","Women Medical Scrub Set","Men Medical Scrub Set","Nursing Tunic","Nursing Dress","Medical Lab Coat","Pharmacy Lab Coat","Dental Scrub Set","Theatre Scrub Set","Maternity Scrub Set","Healthcare Fleece Jacket","Chef Jacket","Chef Trousers","Chef Apron","Corporate Polo Shirt","Corporate Oxford Shirt","Security Officer Shirt","Industrial Dust Coat"],{material:"Easy-care polycotton",age_group:"Adult",sizes:["XS","S","M","L","XL","2XL","3XL"],colours:["White","Navy","Royal Blue","Ceil Blue","Green","Grey","Black","Maroon"],image_query:"medical scrubs uniform"});

async function commonsImage(query,slug,fallback){
  let candidate;
  const q=query.toLowerCase();
  const mediaCategory=q.match(/shoe|sandal|gumboot|lace/) ? "Shoes" : q.match(/shirt|blouse|polo/) ? "Shirts" : q.match(/trouser|pants/) ? "Trousers" : q.includes("skirt") ? "Skirts" : q.match(/dress|pinafore|tunic/) ? "Dresses" : q.match(/sweater|cardigan|pullover|jersey/) ? "Sweaters" : q.match(/blazer|jacket|coat/) ? "Jackets" : q.match(/bag|backpack|pouch|case/) ? "Bags" : q.includes("bottle") ? "Bottles" : q.includes("socks") ? "Socks" : q.includes("tie") ? "Neckties" : q.includes("belt") ? "Belts" : q.includes("blanket") ? "Blankets" : q.includes("towel") ? "Towels" : q.match(/pyjama|pajama/) ? "Pajamas" : q.match(/scrub|medical|nursing|pharmacy|dental|theatre/) ? "Medical clothing" : "Clothing";
  for(const search of [query.replace(/\s+Kenya$/i,` incategory:"${mediaCategory}"`),`${fallback} incategory:"${mediaCategory}"`,`incategory:"${mediaCategory}"`]){
    const params=new URLSearchParams({action:"query",generator:"search",gsrsearch:search,gsrnamespace:"6",gsrlimit:"10",prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"900",format:"json",origin:"*"});
    const response=await fetch(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{"User-Agent":"UniformKingsCatalogResearch/1.0 (admin@uniformkings.co.ke)"}});
    if(!response.ok)throw new Error(`Commons search failed: ${response.status}`);
    const pages=Object.values((await response.json()).query?.pages || {});
    const base=search.toLowerCase().split("incategory:")[0].trim() || mediaCategory.toLowerCase();
    const keywords=base.split(/\W+/).filter((word)=>word.length>3 && !["kenya","school","unisex","junior","senior"].includes(word)).map((word)=>word.replace(/s$/, ""));
    candidate=pages.map((page)=>({page,info:page.imageinfo?.[0],score:keywords.filter((word)=>page.title.toLowerCase().includes(word)).length})).filter(({page,info,score})=>score>0 && !/story|book|poster|advert|catalog|painting|drawing|conference|meeting|portrait|logo|map|diagram/i.test(page.title) && info?.thumburl && /^(CC|Public domain)/i.test(info.extmetadata?.LicenseShortName?.value || "")).sort((a,b)=>b.score-a.score)[0];
    if(candidate)break;
  }
  if(!candidate){
    const label=query.replace(/\s+Kenya$/i,"").replace(/[<>&]/g,"").slice(0,52),filename=`${slug}.svg`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" fill="#f1f4f8"/><circle cx="450" cy="340" r="150" fill="#063b82"/><text x="450" y="375" text-anchor="middle" font-family="Arial,sans-serif" font-size="92" font-weight="700" fill="#f5bd22">UK</text><text x="450" y="570" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#071d3e">${label}</text><text x="450" y="625" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#52637a">Product image coming soon</text></svg>`;
    await writeFile(path.join(imageDirectory,filename),svg);
    return {path:`/uploads/catalog-launch/${filename}`,alt:`${label} - Uniform Kings Kenya`,source_url:null,license:"Uniform Kings original",credit:"Uniform Kings"};
  }
  const {page,info}=candidate, extension=new URL(info.thumburl).pathname.match(/\.(jpe?g|png|webp)$/i)?.[1]?.toLowerCase() || "jpg", filename=`${slug}.${extension}`;
  let imageResponse;
  for(let attempt=0;attempt<4;attempt++){ imageResponse=await fetch(info.thumburl,{headers:{"User-Agent":"UniformKingsCatalogResearch/1.0 (admin@uniformkings.co.ke)"}}); if(imageResponse.status!==429)break; await wait(3000*(attempt+1)); }
  if(!imageResponse.ok){const filename=`${slug}.svg`,label=fallback.replace(/[<>&]/g,"").slice(0,52);await writeFile(path.join(imageDirectory,filename),`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="100%" height="100%" fill="#f1f4f8"/><circle cx="450" cy="340" r="150" fill="#063b82"/><text x="450" y="375" text-anchor="middle" font-family="Arial" font-size="92" font-weight="700" fill="#f5bd22">UK</text><text x="450" y="570" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="#071d3e">${label}</text></svg>`);return {path:`/uploads/catalog-launch/${filename}`,alt:`${label} - Uniform Kings Kenya`,license:"Uniform Kings original",credit:"Uniform Kings"};}
  await writeFile(path.join(imageDirectory,filename),Buffer.from(await imageResponse.arrayBuffer()));
  return {path:`/uploads/catalog-launch/${filename}`,alt:`${query} - Uniform Kings Kenya`,source_url:info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/^File:/,"File:"))}`,license:info.extmetadata?.LicenseShortName?.value || "",credit:(info.extmetadata?.Artist?.value || "Wikimedia Commons").replace(/<[^>]+>/g,"").slice(0,255)};
}

const imageFallback={"school-uniforms":"school uniform","sports-pe-wear":"sports uniform","footwear-shoe-care":"school shoes","bags-school-essentials":"school backpack","uniform-accessories":"clothing accessories","bedding-nightwear":"bedding","professional-healthcare-wear":"medical scrubs"};
function starterPrice(name,category){
  const n=name.toLowerCase(), match=(words)=>words.some((word)=>n.includes(word));
  if(category==="school-uniforms")return match(["blazer"])?2800:match(["fleece"])?1800:match(["sweater","cardigan","pullover","jersey"])?1500:match(["dress","pinafore"])?1400:match(["trousers"])?1200:match(["skirt"])?1000:850;
  if(category==="sports-pe-wear")return match(["tracksuit set"])?2500:match(["track jacket","track pants"])?1400:match(["swim"])?1200:match(["jersey"])?1000:match(["polo"])?900:match(["socks"])?300:700;
  if(category==="footwear-shoe-care")return match(["polish"])?250:match(["brush"])?200:match(["laces"])?150:match(["sandals"])?1400:match(["gumboots"])?1800:2500;
  if(category==="bags-school-essentials")return match(["wheeled"])?3500:match(["backpack"])?1800:match(["stainless","insulated water"])?1500:match(["water bottle"])?800:match(["lunch bag"])?800:match(["lunch box"])?700:500;
  if(category==="uniform-accessories")return match(["socks"])?300:match(["tie"])?450:match(["belt"])?500:match(["repair"])?500:match(["thread"])?350:match(["buttons"])?200:300;
  if(category==="bedding-nightwear")return match(["duvet"])?2500:match(["sheet set"])?2000:match(["blanket"])?1800:match(["pyjamas"])?1500:match(["bath towel"])?800:match(["face towel"])?350:700;
  return match(["scrub set"])?2500:match(["fleece"])?2200:match(["lab coat","tunic","dress","chef jacket","chef trousers"])?1800:match(["apron"])?700:match(["polo"])?1000:match(["oxford"])?1500:match(["security"])?1200:1600;
}
for(let start=0;start<products.length;start+=3){
  const created=await Promise.all(products.slice(start,start+3).map(async(product,offset)=>{
    const index=start+offset,slug=slugify(product.name);
    if(completed.some((item)=>item.slug===slug)){console.log(`${index+1}/${products.length} ${product.name} (cached)`);return null;}
    const image=await commonsImage(product.image_query,slug,imageFallback[product.category_slug]);
    delete product.image_query;
    Object.assign(product,{slug,short_description:`Practical ${product.name.toLowerCase()} with clearly selectable sizes and colours for convenient ordering.`,description:`Choose ${product.name.toLowerCase()} from Uniform Kings. Review the available size and colour options before ordering. Contact the store for school-specific colours, branding or bulk requirements.`,price:starterPrice(product.name,product.category_slug),compare_price:null,stock:50,status:"draft",is_featured:false,is_new:true,seo_title:`${product.name} in Kenya | Uniform Kings`,seo_description:`Shop ${product.name.toLowerCase()} from Uniform Kings Kenya with clear size and colour choices.`,images:[image]});
    console.log(`${index+1}/${products.length} ${product.name}`);return product;
  }));
  completed.push(...created.filter(Boolean));
  await writeFile(output,JSON.stringify({categories:template.categories,products:completed},null,2));
  await wait(400);
}
await writeFile(output,JSON.stringify({categories:template.categories,products:completed},null,2));
console.log(`Created ${output} with ${products.length} draft products and licensed images in ${imageDirectory}.`);
