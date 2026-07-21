import "dotenv/config";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { nanoid } from "nanoid";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: npm run catalog:import -- /path/to/catalog.json");
const catalog = JSON.parse(await readFile(filename, "utf8"));
if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) throw new Error("The file must contain categories[] and products[].");
const slugify = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 190);
const text = (value, maximum = 500) => value == null ? null : String(value).trim().slice(0, maximum) || null;
const uniqueText = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()))];
const connection = await mysql.createConnection({ host:process.env.DB_HOST || "127.0.0.1", port:Number(process.env.DB_PORT || 3306), user:process.env.DB_USER || "root", password:process.env.DB_PASSWORD || "", database:process.env.DB_NAME || "uniform_kings", multipleStatements:false });

await connection.beginTransaction();
try {
  for (const category of catalog.categories) {
    const name = text(category.name, 120), slug = slugify(category.slug || name);
    if (!name || !slug) throw new Error("Every category requires a name.");
    await connection.execute(`INSERT INTO categories(name,slug,description,seo_title,seo_description,is_active,sort_order) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),seo_title=VALUES(seo_title),seo_description=VALUES(seo_description),is_active=VALUES(is_active),sort_order=VALUES(sort_order)`, [name,slug,text(category.description,5000),text(category.seo_title,190),text(category.seo_description,300),category.is_active === false ? 0 : 1,Number(category.sort_order || 0)]);
  }
  for (const product of catalog.products) {
    const name=text(product.name,190), slug=slugify(product.slug || name), categorySlug=slugify(product.category_slug);
    if (!name || !slug || !categorySlug) throw new Error("Every product requires name and category_slug.");
    const [[category]] = await connection.execute("SELECT id FROM categories WHERE slug=?", [categorySlug]);
    if (!category) throw new Error(`Unknown category: ${categorySlug}`);
    let schoolId=null;
    if (product.school_slug) { const [[school]]=await connection.execute("SELECT id FROM schools WHERE slug=?",[slugify(product.school_slug)]); if(!school)throw new Error(`Unknown school: ${product.school_slug}`); schoolId=school.id; }
    const status=["draft","active","archived"].includes(product.status) ? product.status : "draft";
    const price=Number(product.price || 0), compare=product.compare_price == null || product.compare_price === "" ? null : Number(product.compare_price);
    if (price < 0 || (compare != null && compare < 0)) throw new Error(`Invalid price for ${name}`);
    if (status === "active" && price <= 0) throw new Error(`${name} cannot be active without a selling price.`);
    await connection.execute(`INSERT INTO products(category_id,school_id,name,slug,sku,brand,product_type,gender,age_group,material,google_product_category,source_url,short_description,description,price,compare_price,stock,status,is_featured,is_new,seo_title,seo_description) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE category_id=VALUES(category_id),school_id=VALUES(school_id),name=VALUES(name),brand=VALUES(brand),product_type=VALUES(product_type),gender=VALUES(gender),age_group=VALUES(age_group),material=VALUES(material),google_product_category=VALUES(google_product_category),source_url=VALUES(source_url),short_description=VALUES(short_description),description=VALUES(description),price=VALUES(price),compare_price=VALUES(compare_price),stock=VALUES(stock),status=VALUES(status),is_featured=VALUES(is_featured),is_new=VALUES(is_new),seo_title=VALUES(seo_title),seo_description=VALUES(seo_description)`, [category.id,schoolId,name,slug,text(product.sku,80) || `UK-${nanoid(10).toUpperCase()}`,text(product.brand,120),text(product.product_type,120),text(product.gender,30),text(product.age_group,40),text(product.material,160),text(product.google_product_category,190),text(product.source_url,500),text(product.short_description,300),text(product.description,5000),price,compare,Math.max(0,Number(product.stock || 0)),status,product.is_featured?1:0,product.is_new?1:0,text(product.seo_title,190),text(product.seo_description,300)]);
    const [[saved]] = await connection.execute("SELECT id FROM products WHERE slug=?",[slug]);
    if (product.replace_options !== false) {
      await connection.execute("DELETE FROM product_variants WHERE product_id=?",[saved.id]);
      const sizes=uniqueText(product.sizes); if (!sizes.length) sizes.push("");
      const colours=uniqueText(product.colours); if (!colours.length) colours.push("");
      for(const size of sizes) for(const colour of colours) await connection.execute("INSERT INTO product_variants(product_id,size,colour,sku,stock,low_stock_level,price_adjustment) VALUES(?,?,?,?,0,5,0)",[saved.id,size.trim(),colour.trim(),`UKV-${nanoid(10).toUpperCase()}`]);
    }
    if (Array.isArray(product.images) && product.images.length) {
      if (product.replace_images) await connection.execute("DELETE FROM product_images WHERE product_id=?",[saved.id]);
      for(const [index,image] of product.images.entries()) { const metadata=typeof image === "object" ? image : {}; const path=text(typeof image === "string" ? image : image.path,500); if(!path || (!path.startsWith("/uploads/") && !/^https:\/\//i.test(path))) throw new Error(`Invalid image path for ${name}`); const [[existingImage]]=await connection.execute("SELECT id FROM product_images WHERE product_id=? AND image_path=? LIMIT 1",[saved.id,path]); if(!existingImage) await connection.execute("INSERT INTO product_images(product_id,image_path,alt_text,source_url,license_name,credit_text,sort_order) VALUES(?,?,?,?,?,?,?)",[saved.id,path,text(metadata.alt || `${name} - Uniform Kings Kenya`,190),text(metadata.source_url,500),text(metadata.license,120),text(metadata.credit,255),index]); }
    }
  }
  await connection.commit();
  console.log(`Imported ${catalog.categories.length} categories and ${catalog.products.length} products. New products default to draft unless explicitly active.`);
} catch (error) { await connection.rollback(); throw error; } finally { await connection.end(); }
