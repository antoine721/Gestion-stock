-- Schema minimal : un evenement, ses reglages communs, ses co-organisateurs.
-- Applique par `npm run db:init`. Idempotent.

create table if not exists evenements (
  code       text primary key,
  partage    jsonb       not null,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now()
);

create table if not exists participants (
  id             text        primary key,
  evenement_code text        not null references evenements(code) on delete cascade,
  nom            text        not null,
  effectifs      jsonb       not null default '[]'::jsonb,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);

create index if not exists participants_evenement on participants (evenement_code, cree_le);

-- Migration depuis le modele « predictions » : les invites et la part de
-- buveurs se deduisent desormais des effectifs par profil.
alter table participants add column if not exists effectifs jsonb not null default '[]'::jsonb;
alter table participants drop column if exists predictions;
alter table participants drop column if exists invites;
alter table participants drop column if exists part_buveurs;

-- Le mot de passe est desormais unique pour toute l'app (variable
-- d'environnement MOT_DE_PASSE) : plus de secret par evenement.
alter table evenements drop column if exists sel;
alter table evenements drop column if exists empreinte;
