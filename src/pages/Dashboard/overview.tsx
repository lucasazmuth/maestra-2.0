import { CSSProperties, FC, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { PlanoAcaoIcon, AgendaIcon, CatalogoIcon, EquipeIcon } from '../../components/Icons/system';
import { FaSpotify } from 'react-icons/fa6';

import { listEvents } from '../../services/db/events';
import { listCatalogItems } from '../../services/db/catalog';
import { listMembers } from '../../services/db/members';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { TASK_TYPES } from '../ActionPlan/TaskComposer';
import { EVENT_TYPES, CATALOG_STATUS, ACCESS_LEVELS } from '../../constants/maestra';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import type { AgendaEvent, Artist, ArtistContent, ArtistMember, CatalogItem, Strategy } from '../../interfaces/maestra';

// Respeita o "reduzir movimento" do sistema (a timeline anima só quando permitido).
const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Painéis de visão geral do Dashboard: timeline das próximas tarefas, próximos eventos,
// catálogo do Spotify, catálogo cadastrado e equipe atual. Mesmo vocabulário visual do
// Dashboard (cards #181818, títulos SpotifyMixUITitle). Cada painel busca seus próprios dados.

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtDate = (d?: string | null): string =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';

const sectionTitle: CSSProperties = { color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' };

const Panel: FC<{ icon: ReactNode; title: string; action?: { label: string; onClick: () => void }; children: ReactNode }> = ({
  icon, title, action, children,
}) => (
  <section style={{ background: '#181818', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{ color: '#b3b3b3', display: 'flex' }}>{icon}</span>
      <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0, flex: 1, fontFamily: 'SpotifyMixUITitle' }}>{title}</h3>
      {action && (
        <button
          onClick={action.onClick}
          style={{ background: 'transparent', border: 'none', color: '#b3b3b3', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#b3b3b3')}
        >
          {action.label} <FiChevronRight size={14} />
        </button>
      )}
    </div>
    {children}
  </section>
);

const Empty: FC<{ text: string }> = ({ text }) => <div style={{ color: '#6f6f6f', fontSize: 13, padding: '6px 0' }}>{text}</div>;

export const DashboardOverview: FC<{ artist: Artist }> = ({ artist }) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);
  const go = (to: string) => navigate(`/artists/${artist.id}/${to}`);

  const toggleDone = (strategyId: string, taskId: string, currentStatus: string) => {
    const strategies: Strategy[] = artist.content?.strategies || [];
    const next: ArtistContent = {
      ...artist.content,
      strategies: strategies.map((s) =>
        s.id !== strategyId
          ? s
          : { ...s, tasks: (s.tasks || []).map((t) => (t.id === taskId ? { ...t, status: currentStatus === 'done' ? 'todo' : 'done' } : t)) }
      ),
    };
    dispatch(artistsActions.setArtistContentLocal({ id: artist.id, content: next }));
    dispatch(artistsActions.updateArtistContent({ id: artist.id, content: next }));
  };

  useEffect(() => {
    let alive = true;
    listEvents(artist.id).then((d) => alive && setEvents(d)).catch(() => {});
    listCatalogItems(artist.id).then((d) => alive && setItems(d)).catch(() => {});
    listMembers(artist.id).then((d) => alive && setMembers(d)).catch(() => {});
    return () => { alive = false; };
  }, [artist.id]);

  const today = todayStr();
  const strategies: Strategy[] = artist.content?.strategies || [];
  const upcomingTasks = strategies
    .flatMap((s) => (s.tasks || []).filter((t) => t.status !== 'done' && t.status !== 'archived').map((t) => ({ t, strat: s.title, stratId: s.id })))
    .sort((a, b) => ((a.t.deadline || '9999') < (b.t.deadline || '9999') ? -1 : 1))
    .slice(0, 5);
  const upcomingEvents = events.filter((e) => (e.date || '') >= today && e.status !== 'cancelled').slice(0, 5);
  const spTracks = artist.content?.spotifyCatalog?.tracks || [];
  const spAlbums = artist.content?.spotifyCatalog?.albums || [];
  const spItems: any[] = spTracks.length ? spTracks : spAlbums;
  const activeMembers = members.filter((m) => m.status === 'active');

  return (
    <>
      <h2 style={sectionTitle}>Visão geral</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Próximas tarefas — timeline */}
        <Panel icon={<PlanoAcaoIcon size={18} />} title="Próximas tarefas" action={{ label: 'Plano de ação', onClick: () => go('action-plan') }}>
          {upcomingTasks.length === 0 ? (
            <Empty text="Nenhuma tarefa pendente." />
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 9, top: 18, bottom: 22, width: 2, background: 'linear-gradient(180deg, #af2896, rgba(175, 40, 150,0.12))', transformOrigin: 'top', ...(REDUCE_MOTION ? {} : { transform: 'scaleY(0)', animation: 'apTlLine .9s cubic-bezier(0.4,0,0.2,1) .1s forwards' }) }} />
              {upcomingTasks.map(({ t, strat, stratId }, i) => {
                const od = !!(t.deadline && t.deadline < today);
                return (
                  <div key={t.id || i} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0', ...(REDUCE_MOTION ? {} : { opacity: 0, animation: 'apTlItem .45s ease forwards', animationDelay: `${0.15 + i * 0.14}s` }) }}>
                    <button
                      onClick={() => toggleDone(stratId, t.id, t.status || 'todo')}
                      title="Marcar como concluída"
                      style={{
                        zIndex: 1,
                        width: 20,
                        height: 20,
                        minWidth: 20,
                        marginTop: 1,
                        borderRadius: '50%',
                        border: '2px solid #535353',
                        background: '#181818',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'transparent',
                        padding: 0,
                        transition: 'transform 33ms ease, background-color 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#af2896'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#535353'; e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                    {t.deadline && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginTop: 1,
                        fontSize: 12,
                        fontWeight: 700,
                        color: od ? '#ff6b6b' : '#fff',
                        background: od ? 'rgba(233,20,41,0.14)' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: 9999,
                        padding: '4px 12px',
                        whiteSpace: 'nowrap',
                      }}>
                        {fmtDate(t.deadline)}
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                      <div style={{ fontSize: 14, lineHeight: 1.45, color: '#ededed' }}>{t.description}</div>
                      {t.type && (
                        <span style={{
                          display: 'inline-block',
                          marginTop: 6,
                          fontSize: 11,
                          color: '#b3b3b3',
                          background: 'rgba(255,255,255,0.07)',
                          borderRadius: 4,
                          padding: '3px 8px',
                        }}>
                          {TASK_TYPES.find((o) => o.v === t.type)?.label || t.type}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Próximos eventos */}
        <Panel icon={<AgendaIcon size={18} />} title="Próximos eventos" action={{ label: 'Agenda', onClick: () => go('agenda') }}>
          {upcomingEvents.length === 0 ? (
            <Empty text="Nenhum evento agendado." />
          ) : (
            upcomingEvents.map((e) => {
              const meta = (EVENT_TYPES as any)[e.type] || { label: e.type, color: '#6b7280' };
              const d = new Date(`${e.date}T00:00:00`);
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ minWidth: 42, textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ color: '#8a8a8a', fontSize: 10.5, textTransform: 'uppercase' }}>{d.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                    {(e.start_time || e.location) && <div style={{ color: '#8a8a8a', fontSize: 11.5 }}>{e.start_time ? `${e.start_time}${e.location ? ' · ' : ''}` : ''}{e.location || ''}</div>}
                  </div>
                  <span style={{ color: meta.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{meta.label}</span>
                </div>
              );
            })
          )}
        </Panel>

        {/* Lançamentos (Spotify) */}
        <Panel icon={<FaSpotify size={16} color="#af2896" />} title="Lançamentos" action={{ label: 'Catálogo', onClick: () => go('catalog') }}>
          {spItems.length === 0 ? (
            <Empty text="Conecte o Spotify para ver seus lançamentos publicados." />
          ) : (
            spItems.slice(0, 5).map((tr) => (
              <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                <img src={tr.album_image || tr.image || ARTISTS_DEFAULT_IMAGE} alt="" style={{ width: 38, height: 38, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</div>
                  <div style={{ color: '#8a8a8a', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.album || tr.release_date || ''}</div>
                </div>
              </div>
            ))
          )}
        </Panel>

        {/* Catálogo (sistema) — itens manuais (aba "Faixas / Rascunho" da página de Catálogo) */}
        <Panel icon={<CatalogoIcon size={18} />} title="Faixas / Rascunho" action={{ label: 'Catálogo', onClick: () => go('catalog') }}>
          {items.length === 0 ? (
            <Empty text="Nenhuma faixa no catálogo ainda." />
          ) : (
            items.slice(0, 5).map((it) => {
              const st = (CATALOG_STATUS as any)[it.status] || { label: it.status, color: '#6b7280' };
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    {it.release_date && <div style={{ color: '#8a8a8a', fontSize: 11.5 }}>{fmtDate(it.release_date)}</div>}
                  </div>
                  <span style={{ color: st.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.label}</span>
                </div>
              );
            })
          )}
        </Panel>

        {/* Equipe atual */}
        <Panel icon={<EquipeIcon size={18} />} title="Equipe atual" action={{ label: 'Equipe', onClick: () => go('team') }}>
          {activeMembers.length === 0 ? (
            <Empty text="Nenhum membro na equipe ainda." />
          ) : (
            activeMembers.slice(0, 5).map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2a2a2a', color: '#b3b3b3', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {(m.name || m.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.email}</div>
                  <div style={{ color: '#8a8a8a', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(m.access_levels || []).map((a) => (ACCESS_LEVELS as any)[a] || a).join(' · ') || 'Membro'}
                  </div>
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </>
  );
};

export default DashboardOverview;
