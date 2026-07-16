// ---------- Conexão com o Supabase ----------
(function () {
  if (window.__supabaseClientReady) return; // evita redeclaração se o script rodar 2x
  window.__supabaseClientReady = true;

  // Essas duas informações NÃO são segredo: identificam o projeto.
  // Quem protege os dados de verdade são as políticas RLS no banco.
  const SUPABASE_URL = 'https://iypcjdxittuqcdojjljn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5cGNqZHhpdHR1cWNkb2pqbGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzAxNTksImV4cCI6MjA5OTU0NjE1OX0.OcUGUIav661QPYgLC4-xFZUe4RKW8QhQZWit9wAbMOw';

  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = window.supabase; // mantém compatível com quem inspeciona no console
})();