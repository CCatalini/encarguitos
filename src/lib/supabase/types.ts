import type { ThemeColor } from "@/lib/theme";

// Tipos del modelo de datos. Reflejan 1:1 las tablas de supabase/schema.sql.
// Cuando el schema cambie, actualizar acá (más adelante se puede generar
// automáticamente con `supabase gen types typescript`).

export type Requester = {
  id: string;
  name: string;
  color: ThemeColor;
  created_at: string;
};

export type Category = {
  id: string;
  requester_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type Item = {
  id: string;
  category_id: string;
  brand: string | null;
  comment: string | null;
  purchased: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type ItemImage = {
  id: string;
  item_id: string;
  url: string;
  sort_order: number;
  created_at: string;
};

// Shape mínimo que necesita el cliente de Supabase tipado (createClient<Database>).
// "Relationships: []" y "Views/Functions: {}" son requeridos por los tipos
// internos de @supabase/postgrest-js (GenericTable/GenericSchema) aunque acá
// no los usemos — sin ellos, TypeScript colapsa las filas a `never`.
// Se puede reemplazar por los tipos autogenerados por la CLI de Supabase
// (`supabase gen types typescript`) cuando el schema esté versionado ahí.
export type Database = {
  public: {
    Tables: {
      requesters: {
        Row: Requester;
        Insert: Partial<Requester> & { name: string };
        Update: Partial<Requester>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Partial<Category> & { requester_id: string; name: string };
        Update: Partial<Category>;
        Relationships: [];
      };
      items: {
        Row: Item;
        Insert: Partial<Item> & { category_id: string };
        Update: Partial<Item>;
        Relationships: [];
      };
      item_images: {
        Row: ItemImage;
        Insert: Partial<ItemImage> & { item_id: string; url: string };
        Update: Partial<ItemImage>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
