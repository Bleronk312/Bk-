-- ============================================================================
-- GEKO · Ober-Admin festlegen
-- ============================================================================
-- Es gibt jetzt zwei Stufen in der Verwaltung:
--
--   Verwaltung (geko_rolle = 'admin')
--     sieht und bearbeitet alle Daten: Touren, Kunden, Objekte, Urlaub,
--     Scheine, Mitarbeiter-Stammdaten. Das ist die normale Bürokraft.
--
--   Ober-Admin (zusätzlich geko_super = true)
--     darf als EINZIGER die Zugänge verwalten: Konten anlegen und löschen,
--     Passwörter zurücksetzen, sperren, Rollen vergeben.
--
-- Warum getrennt? Wer Passwörter zurücksetzen kann, kann sich als jeder
-- beliebige Mitarbeiter anmelden. Das soll an genau einer Person hängen,
-- nicht an jedem, der Touren eintragen darf.
--
-- geko_super steht in app_metadata und ist damit NUR hier per SQL setzbar -
-- kein Admin kann sich selbst befördern, auch nicht über die App.
-- ============================================================================

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                           || '{"geko_rolle":"admin","geko_super":true}'::jsonb
 where email = 'bleron_k@hotmail.de';

-- Kontrolle: Wer ist was?
select email,
       raw_app_meta_data ->> 'geko_rolle' as rolle,
       coalesce(raw_app_meta_data ->> 'geko_super', 'false') as ober_admin
from auth.users
order by email;

-- ---------------------------------------------------------------------------
-- Falls die Rolle einmal an jemand anderen übergeben werden soll:
-- ---------------------------------------------------------------------------
-- Erst dem Neuen geben ...
--   update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                              || '{"geko_rolle":"admin","geko_super":true}'::jsonb
--    where email = 'NEUE-ADRESSE';
--
-- ... und erst danach beim Alten entfernen (sonst steht man ohne Ober-Admin da
-- und kommt an die Zugangsverwaltung nur noch über dieses SQL heran):
--   update auth.users
--      set raw_app_meta_data = raw_app_meta_data - 'geko_super'
--    where email = 'ALTE-ADRESSE';
