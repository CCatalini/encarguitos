// Tipos del modelo de datos. Reflejan 1:1 las tablas de supabase/schema.sql.
// Cuando el schema cambie, actualizar acá (más adelante se puede generar
// automáticamente con `supabase gen types typescript`).

export type Hija = {
  id: string;
  nombre: string;
  creado_en: string;
};

export type Categoria = {
  id: string;
  hija_id: string;
  nombre: string;
  orden: number;
  creado_en: string;
};

export type Item = {
  id: string;
  categoria_id: string;
  imagen_url: string | null;
  marca: string | null;
  comentario: string | null;
  comprado: boolean;
  creado_por: string | null;
  creado_en: string;
};

// Shape mínimo que necesita el cliente de Supabase tipado (createClient<Database>).
// Se puede reemplazar por los tipos autogenerados por la CLI de Supabase cuando
// el schema esté cargado en un proyecto real.
export type Database = {
  public: {
    Tables: {
      hijas: {
        Row: Hija;
        Insert: Partial<Hija> & { nombre: string };
        Update: Partial<Hija>;
      };
      categorias: {
        Row: Categoria;
        Insert: Partial<Categoria> & { hija_id: string; nombre: string };
        Update: Partial<Categoria>;
      };
      items: {
        Row: Item;
        Insert: Partial<Item> & { categoria_id: string };
        Update: Partial<Item>;
      };
    };
  };
};
