// Tipos del modelo de datos. Reflejan 1:1 las tablas de supabase/schema.sql.
// Cuando el schema cambie, actualizar acá (más adelante se puede generar
// automáticamente con `supabase gen types typescript`).

export type Requester = {
  id: string;
  name: string;
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
  image_url: string | null;
  brand: string | null;
  comment: string | null;
  purchased: boolean;
  created_by: string | null;
  created_at: string;
};

// Shape mínimo que necesita el cliente de Supabase tipado (createClient<Database>).
// Se puede reemplazar por los tipos autogenerados por la CLI de Supabase cuando
// el schema esté cargado en un proyecto real.
export type Database = {
  public: {
    Tables: {
      requesters: {
        Row: Requester;
        Insert: Partial<Requester> & { name: string };
        Update: Partial<Requester>;
      };
      categories: {
        Row: Category;
        Insert: Partial<Category> & { requester_id: string; name: string };
        Update: Partial<Category>;
      };
      items: {
        Row: Item;
        Insert: Partial<Item> & { category_id: string };
        Update: Partial<Item>;
      };
    };
  };
};
