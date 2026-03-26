import { NextRequest, NextResponse } from "next/server";

// Maps Open Food Facts category tags to our app's categories
const CATEGORY_KEYWORDS: [string, string][] = [
  ["dairy", "Dairy"],
  ["milk", "Dairy"],
  ["cheese", "Dairy"],
  ["yogurt", "Dairy"],
  ["butter", "Dairy"],
  ["cream", "Dairy"],
  ["beverages", "Beverages"],
  ["drinks", "Beverages"],
  ["juice", "Beverages"],
  ["waters", "Beverages"],
  ["sodas", "Beverages"],
  ["coffee", "Beverages"],
  ["tea", "Beverages"],
  ["vegetables", "Vegetables"],
  ["fruits", "Fruits"],
  ["meats", "Meat"],
  ["poultry", "Meat"],
  ["seafood", "Meat"],
  ["fish", "Meat"],
  ["snacks", "Snacks"],
  ["chips", "Snacks"],
  ["biscuits", "Snacks"],
  ["cookies", "Snacks"],
  ["crackers", "Snacks"],
  ["chocolate", "Snacks"],
  ["candy", "Snacks"],
  ["cereals", "Grains"],
  ["bread", "Grains"],
  ["rice", "Grains"],
  ["pasta", "Grains"],
  ["flour", "Grains"],
  ["grains", "Grains"],
  ["noodles", "Grains"],
  ["condiments", "Condiments"],
  ["sauces", "Condiments"],
  ["ketchup", "Condiments"],
  ["dressings", "Condiments"],
  ["vinegar", "Condiments"],
  ["frozen", "Frozen"],
  ["ice-cream", "Frozen"],
];

function mapCategory(categoryTags: string[]): string {
  for (const tag of categoryTags) {
    // Open Food Facts tags look like "en:dairy-products"
    const normalized = tag.toLowerCase().replace(/^[a-z]{2}:/, "");
    for (const [keyword, appCategory] of CATEGORY_KEYWORDS) {
      if (normalized.includes(keyword)) return appCategory;
    }
  }
  return "General";
}

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get("barcode");

  // Validate: only allow 8–14 digit numeric barcodes (EAN-8, EAN-13, UPC-A, UPC-E)
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });
  }

  let offResponse: Response;
  try {
    offResponse = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      {
        headers: {
          "User-Agent": "ShelfWatch/1.0 (grocery inventory app)",
        },
        // Cache successful lookups for 24 hours to reduce API load
        next: { revalidate: 86400 },
      }
    );
  } catch {
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }

  if (!offResponse.ok) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 502 });
  }

  const json = await offResponse.json();

  // status 1 = product found, 0 = not found
  if (json.status !== 1) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const product = json.product;
  // Prefer English name, fall back to generic name
  const name: string =
    product.product_name_en ||
    product.product_name ||
    product.abbreviated_product_name ||
    "";

  const categoryTags: string[] = product.categories_tags ?? [];
  const category = mapCategory(categoryTags);

  return NextResponse.json({ name: name.trim(), category });
}
