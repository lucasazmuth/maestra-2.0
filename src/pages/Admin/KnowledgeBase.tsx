import { FC, useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Button,
  Tag,
  Select,
  message,
  Modal,
  Space,
  Popconfirm,
  Progress,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  CloudUploadOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { FiUploadCloud, FiDatabase, FiClock, FiCheckCircle, FiXCircle, FiFileText } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

// ---- Types ----

interface ParsedPlan {
  key: string;
  fileName: string;
  artist: string;
  vision?: string;
  mission?: string;
  values?: string;
  objectives: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  strategies: string[];
  fullContent: string;
  segment: string;
  artist_size: string;
  career_stage: string;
  plan_type: string;
  quality_score: number;
}

interface StoredPlan {
  id: string;
  title: string;
  segment: string;
  artist_size: string;
  career_stage: string;
  plan_type: string;
  context_summary: string;
  objectives: any;
  strategies: any;
  kpis: any;
  full_content: string;
  quality_score: number;
  source: string;
  status: string;
  created_at: string;
}

// ---- Constants ----

const SEGMENTS = [
  'sertanejo', 'pop', 'rap', 'hip-hop', 'rock', 'mpb', 'pagode', 'samba',
  'funk', 'gospel', 'eletronica', 'indie', 'folk', 'jazz', 'blues',
  'reggae', 'forro', 'axe', 'classico', 'outro',
];

const ARTIST_SIZES = [
  { value: 'small', label: 'Pequeno (até 100k)' },
  { value: 'medium', label: 'Médio (100k-1M)' },
  { value: 'large', label: 'Grande (1M-10M)' },
  { value: 'major', label: 'Major (10M+)' },
];

const CAREER_STAGES = [
  { value: 'emerging', label: 'Emergente' },
  { value: 'growing', label: 'Crescimento' },
  { value: 'established', label: 'Estabelecido' },
  { value: 'legacy', label: 'Legado' },
];

// ---- XLS Parser ----

function parseXLS(file: File): Promise<ParsedPlan> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let artist = '';
        let vision = '';
        let mission = '';
        let values = '';
        let objectives: string[] = [];
        let strengths: string[] = [];
        let weaknesses: string[] = [];
        let opportunities: string[] = [];
        let threats: string[] = [];
        let strategies: string[] = [];
        let actionPlan: string[] = [];
        let timeline: string[] = [];
        let financials: string[] = [];
        let prioritizer: string[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
          const lowerName = sheetName.toLowerCase();

          if (lowerName.includes('vis') || lowerName.includes('miss')) {
            jsonData.forEach((row) => {
              const rowStr = row.join(' ');
              if (/ARTISTA:/i.test(rowStr)) artist = rowStr.replace(/.*ARTISTA:\s*/i, '').trim();
              if (/VIS[ÃA]O:/i.test(rowStr)) vision = rowStr.replace(/.*VIS[ÃA]O:\s*/i, '').trim();
              if (/MISS[ÃA]O:/i.test(rowStr)) mission = rowStr.replace(/.*MISS[ÃA]O:\s*/i, '').trim();
              if (/VALORES:/i.test(rowStr)) values = rowStr.replace(/.*VALORES:\s*/i, '').trim();
            });
          }

          if (lowerName.includes('objetivo') && !lowerName.includes('priorit')) {
            jsonData.forEach((row) => {
              const rowStr = row.filter(Boolean).join(' ').trim();
              if (rowStr && rowStr.length > 5 && !/OBJETIVO|VISÃO|MISSÃO|Table/i.test(rowStr)) {
                objectives.push(rowStr);
              }
            });
          }

          if (lowerName.includes('swot') && !lowerName.includes('cruzada')) {
            // Detectar se é formato tabular (Forças e Fraquezas na mesma linha/header)
            // ou formato linear (seções separadas por headers)
            const headerRow = jsonData.find((row) => {
              const joined = row.filter(Boolean).join(' ');
              return /FORÇAS|FORCAS|Strengths/i.test(joined) && /FRAQUEZAS|Weaknesses/i.test(joined);
            });

            if (headerRow) {
              // Formato tabular: Forças e Fraquezas são colunas na mesma aba
              // Detectar índice das colunas baseado no header
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const _sIdx = headerRow.findIndex((c: any) => /FORÇAS|FORCAS|Strengths/i.test(String(c)));
              const wIdx = headerRow.findIndex((c: any) => /FRAQUEZAS|Weaknesses/i.test(String(c)));
              const oRow = jsonData.find((r) => /OPORTUNIDADES|Opportunities/i.test(r.filter(Boolean).join(' ')));
              const oStartIdx = oRow ? jsonData.indexOf(oRow) : -1;

              // Pegar dados de Forças/Fraquezas (linhas entre header e Oportunidades)
              const headerIdx = jsonData.indexOf(headerRow);
              const endIdx = oStartIdx > 0 ? oStartIdx : jsonData.length;

              for (let ri = headerIdx + 1; ri < endIdx; ri++) {
                const row = jsonData[ri];
                // Forças: geralmente col depois de sIdx (coluna de ID + texto)
                // Buscar texto relevante nas colunas ao redor de sIdx e wIdx
                row.forEach((cell: any, ci: number) => {
                  const text = String(cell || '').trim();
                  if (text.length < 5) return;
                  // Ignorar IDs como S1, W1, O1, T1, E1 e números
                  if (/^[SWOTE]\d+$/i.test(text) || /^\d+$/.test(text)) return;
                  if (/FORÇAS|FRAQUEZAS|Strengths|Weaknesses|OPORTUNIDADES|AMEAÇAS|ESTRATÉGIAS/i.test(text)) return;

                  if (ci <= (wIdx > 0 ? wIdx - 1 : 3)) {
                    strengths.push(text);
                  } else if (ci >= (wIdx > 0 ? wIdx : 4) && ci < (wIdx > 0 ? wIdx + 4 : 7)) {
                    weaknesses.push(text);
                  }
                });
              }

              // Pegar Oportunidades e Ameaças (linhas depois do header O/T)
              if (oStartIdx > 0) {
                const tIdx = headerRow.findIndex((c: any) => /AMEAÇAS|AMEACAS|Threats/i.test(String(c))) || 4;
                for (let ri = oStartIdx + 1; ri < jsonData.length; ri++) {
                  const row = jsonData[ri];
                  row.forEach((cell: any, ci: number) => {
                    const text = String(cell || '').trim();
                    if (text.length < 5) return;
                    if (/^[SWOTE]\d+$/i.test(text) || /^\d+$/.test(text)) return;
                    if (/FORÇAS|FRAQUEZAS|OPORTUNIDADES|AMEAÇAS|Opportunities|Threats/i.test(text)) return;

                    if (ci <= (tIdx > 0 ? tIdx - 1 : 3)) {
                      opportunities.push(text);
                    } else if (ci >= (tIdx > 0 ? tIdx : 4)) {
                      threats.push(text);
                    }
                  });
                }
              }
            } else {
              // Formato linear: seções separadas por headers
              let section = '';
              jsonData.forEach((row) => {
                const rowStr = row.filter(Boolean).join(' ').trim();
                if (/FORÇAS|FORCAS|Strengths/i.test(rowStr)) section = 'S';
                else if (/FRAQUEZAS|Weaknesses/i.test(rowStr)) section = 'W';
                else if (/OPORTUNIDADES|Opportunities/i.test(rowStr)) section = 'O';
                else if (/AMEAÇAS|AMEACAS|Threats/i.test(rowStr)) section = 'T';
                else if (rowStr.length > 5 && section) {
                  row.filter((c: any) => c && String(c).trim().length > 5).forEach((c: any) => {
                    const t = String(c).trim();
                    if (/^[SWOTE]\d+$/i.test(t) || /^\d+$/.test(t)) return;
                    if (section === 'S') strengths.push(t);
                    else if (section === 'W') weaknesses.push(t);
                    else if (section === 'O') opportunities.push(t);
                    else if (section === 'T') threats.push(t);
                  });
                }
              });
            }

            // Extrair estratégias que estão na mesma aba SWOT (coluna E/ESTRATÉGIAS)
            const stratCol = jsonData[0]?.findIndex((c: any) => /ESTRATÉGIAS|ESTRATEGIAS/i.test(String(c || '')));
            if (stratCol && stratCol > 0) {
              jsonData.forEach((row) => {
                const text = String(row[stratCol + 1] || row[stratCol + 2] || '').trim();
                if (text.length > 10 && !/ESTRATÉGIAS/i.test(text)) {
                  strategies.push(text);
                }
              });
            }
          }

          if (lowerName.includes('strat') || lowerName.includes('estratég') || lowerName.includes('cruzada')) {
            jsonData.forEach((row) => {
              const cells = row.filter((c: any) => c && String(c).trim().length > 5);
              const rowStr = cells.join(' — ').trim();
              if (rowStr.length > 10 && !/ESTRATÉGIA|FORÇAS|FRAQUEZAS|Table|Cole a SWOT/i.test(rowStr)) {
                strategies.push(rowStr);
              }
            });
          }

          if (lowerName.includes('priorit')) {
            jsonData.forEach((row) => {
              const cells = row.filter((c: any) => c !== '' && c != null);
              if (cells.length >= 2) prioritizer.push(cells.join(' | '));
            });
          }

          if (lowerName.includes('plano') || lowerName.includes('ação') || lowerName.includes('acao')) {
            jsonData.forEach((row) => {
              const cells = row.filter((c: any) => c !== '' && c != null);
              if (cells.length >= 1 && cells.join(' ').trim().length > 5) actionPlan.push(cells.join(' | '));
            });
          }

          if (lowerName.includes('cronograma') || lowerName.includes('timeline')) {
            jsonData.forEach((row) => {
              const cells = row.filter((c: any) => c !== '' && c != null);
              if (cells.length >= 2) timeline.push(cells.join(' | '));
            });
          }

          if (lowerName.includes('financ') || lowerName.includes('receita') || lowerName.includes('custo')) {
            jsonData.forEach((row) => {
              const cells = row.filter((c: any) => c !== '' && c != null);
              if (cells.length >= 2) financials.push(cells.join(' | '));
            });
          }
        });

        if (!artist) {
          artist = file.name.replace(/\.xlsx?$/i, '').replace(/planejamento.*?-/i, '').replace(/\(.*?\)/g, '').trim();
        }

        objectives = Array.from(new Set(objectives)).filter((o) => o.length > 5).slice(0, 15);
        strategies = Array.from(new Set(strategies)).filter((s) => s.length > 10).slice(0, 40);

        const fullContent = [
          `ARTISTA: ${artist}`,
          vision && `\nVISÃO: ${vision}`,
          mission && `\nMISSÃO: ${mission}`,
          values && `\nVALORES: ${values}`,
          objectives.length > 0 && `\nOBJETIVOS:\n${objectives.map(o => `- ${o}`).join('\n')}`,
          strengths.length > 0 && `\nFORÇAS:\n${strengths.map(s => `- ${s}`).join('\n')}`,
          weaknesses.length > 0 && `\nFRAQUEZAS:\n${weaknesses.map(s => `- ${s}`).join('\n')}`,
          opportunities.length > 0 && `\nOPORTUNIDADES:\n${opportunities.map(s => `- ${s}`).join('\n')}`,
          threats.length > 0 && `\nAMEAÇAS:\n${threats.map(s => `- ${s}`).join('\n')}`,
          strategies.length > 0 && `\nESTRATÉGIAS:\n${strategies.map(s => `- ${s}`).join('\n')}`,
          prioritizer.length > 0 && `\nPRIORIZAÇÃO:\n${prioritizer.slice(0, 30).join('\n')}`,
          actionPlan.length > 0 && `\nPLANO DE AÇÃO:\n${actionPlan.slice(0, 30).join('\n')}`,
          timeline.length > 0 && `\nCRONOGRAMA:\n${timeline.slice(0, 30).join('\n')}`,
          financials.length > 0 && `\nFINANCEIRO:\n${financials.slice(0, 40).join('\n')}`,
        ].filter(Boolean).join('\n').slice(0, 15000);

        resolve({
          key: Math.random().toString(36).slice(2),
          fileName: file.name,
          artist, vision, mission, values, objectives,
          strengths: Array.from(new Set(strengths)),
          weaknesses: Array.from(new Set(weaknesses)),
          opportunities: Array.from(new Set(opportunities)),
          threats: Array.from(new Set(threats)),
          strategies, fullContent,
          segment: 'mpb', artist_size: 'medium', career_stage: 'established',
          plan_type: 'annual', quality_score: 4,
        });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}


// ---- Styles ----

const styles = {
  page: { padding: 24, maxWidth: 1400 } as React.CSSProperties,
  title: { fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: '0 0 24px' } as React.CSSProperties,
  statsRow: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' as const },
  statCard: { background: '#181818', borderRadius: 8, padding: 16, flex: 1, minWidth: 140 } as React.CSSProperties,
  statValue: { color: '#fff', fontSize: 26, fontWeight: 800 } as React.CSSProperties,
  statLabel: { color: '#b3b3b3', fontSize: 13 } as React.CSSProperties,
  tabBtn: (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', border: 'none', borderRadius: 9999, cursor: 'pointer',
    fontSize: 14, fontWeight: active ? 700 : 500, transition: 'all .2s',
    background: active ? '#282828' : 'transparent',
    color: active ? '#fff' : '#b3b3b3',
  }) as React.CSSProperties,
  card: { background: '#181818', borderRadius: 12, padding: 20, marginBottom: 16 } as React.CSSProperties,
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 12px' } as React.CSSProperties,
  badge: (color: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
    borderRadius: 9999, fontSize: 11, fontWeight: 700, background: `${color}20`, color,
  }) as React.CSSProperties,
  emptyState: { textAlign: 'center' as const, padding: 40, color: '#666' },
  modalSection: { marginBottom: 20 } as React.CSSProperties,
  modalSectionTitle: { color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
  modalItem: { color: '#b3b3b3', fontSize: 13, lineHeight: 1.6 } as React.CSSProperties,
  strategyCard: { background: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: '3px solid #af2896' } as React.CSSProperties,
};

// ---- Component ----

const KnowledgeBase: FC = () => {
  const [parsedPlans, setParsedPlans] = useState<ParsedPlan[]>([]);
  const [storedPlans, setStoredPlans] = useState<StoredPlan[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [previewPlan, setPreviewPlan] = useState<ParsedPlan | null>(null);
  const [viewStoredPlan, setViewStoredPlan] = useState<StoredPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'import' | 'pending' | 'approved' | 'rejected'>('pending');

  const loadStoredPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from('strategic_plans')
      .select('id, title, segment, artist_size, career_stage, plan_type, context_summary, objectives, strategies, kpis, full_content, quality_score, source, status, created_at')
      .order('created_at', { ascending: false });
    if (error) message.error('Erro ao carregar: ' + error.message);
    else setStoredPlans(data || []);
  }, []);

  useEffect(() => { loadStoredPlans(); }, [loadStoredPlans]);

  const pendingPlans = storedPlans.filter((p) => p.status === 'pending');
  const approvedPlans = storedPlans.filter((p) => p.status === 'approved');
  const rejectedPlans = storedPlans.filter((p) => p.status === 'rejected');

  const handleUpload = async (file: File) => {
    // Impedir arquivo duplicado na fila
    if (parsedPlans.some((p) => p.fileName === file.name)) {
      message.warning(`"${file.name}" já está na fila.`);
      return false;
    }

    try {
      const parsed = await parseXLS(file);
      
      // Verificar se já existe no banco (por título)
      const expectedTitle = `Planejamento Estratégico - ${parsed.artist}`;
      const alreadyStored = storedPlans.some((p) => p.title === expectedTitle);
      if (alreadyStored) {
        message.warning(`"${parsed.artist}" já existe na base de conhecimento.`);
        return false;
      }

      // Se o parser local não extraiu dados suficientes, usar IA para interpretar
      const hasMinimalData = parsed.objectives.length >= 2 || parsed.strengths.length >= 2 || parsed.strategies.length >= 2;
      
      if (!hasMinimalData && parsed.fullContent.length > 100) {
        message.loading({ content: `Interpretando "${file.name}" com IA...`, key: 'ai-parse', duration: 0 });
        try {
          const { data, error } = await supabase.functions.invoke('parse-strategic-plan', {
            body: { rawText: parsed.fullContent, fileName: file.name },
          });
          if (!error && data) {
            parsed.artist = data.artist || parsed.artist;
            parsed.vision = data.vision || parsed.vision;
            parsed.mission = data.mission || parsed.mission;
            parsed.values = data.values || parsed.values;
            parsed.objectives = data.objectives?.length > 0 ? data.objectives : parsed.objectives;
            parsed.strengths = data.strengths?.length > 0 ? data.strengths : parsed.strengths;
            parsed.weaknesses = data.weaknesses?.length > 0 ? data.weaknesses : parsed.weaknesses;
            parsed.opportunities = data.opportunities?.length > 0 ? data.opportunities : parsed.opportunities;
            parsed.threats = data.threats?.length > 0 ? data.threats : parsed.threats;
            parsed.strategies = data.strategies?.length > 0 ? data.strategies : parsed.strategies;
            parsed.segment = data.segment || parsed.segment;
            parsed.artist_size = data.artist_size || parsed.artist_size;
            parsed.career_stage = data.career_stage || parsed.career_stage;
          }
        } catch (aiErr) {
          console.warn('IA fallback failed, using local parse:', aiErr);
        }
        message.destroy('ai-parse');
      }
      
      setParsedPlans((prev) => [...prev, parsed]);
      message.success(`"${parsed.artist || file.name}" processado`);
    } catch (err: any) {
      message.error(`Erro: ${err.message}`);
    }
    return false;
  };

  const updatePlanField = (key: string, field: keyof ParsedPlan, value: any) => {
    setParsedPlans((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  };

  const importAll = async () => {
    if (parsedPlans.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    let success = 0;
    for (let i = 0; i < parsedPlans.length; i++) {
      const plan = parsedPlans[i];
      try {
        const ctx = [plan.vision && `Visão: ${plan.vision.slice(0, 200)}`, plan.mission && `Missão: ${plan.mission.slice(0, 200)}`].filter(Boolean).join(' | ') || `Planejamento de ${plan.artist}`;
        const { error } = await supabase.from('strategic_plans').insert({
          segment: plan.segment, artist_size: plan.artist_size, career_stage: plan.career_stage,
          plan_type: plan.plan_type, title: `Planejamento Estratégico - ${plan.artist}`,
          context_summary: ctx, objectives: plan.objectives.map((o) => ({ title: o })),
          strategies: plan.strategies.map((s) => ({ title: s })),
          full_content: plan.fullContent, quality_score: plan.quality_score,
          source: 'human', status: 'approved',
        });
        if (error) throw error;
        success++;
      } catch (err: any) {
        message.error(`Erro em "${plan.artist}": ${err.message}`);
      }
      setImportProgress(Math.round(((i + 1) / parsedPlans.length) * 100));
    }
    setImporting(false);
    if (success > 0) { setParsedPlans([]); message.success(`${success} importado(s). Embeddings em até 5 min.`); loadStoredPlans(); }
  };

  const approvePlan = async (id: string) => {
    const { error } = await supabase.from('strategic_plans').update({ status: 'approved' }).eq('id', id);
    if (error) message.error(error.message);
    else { message.success('Aprovado!'); loadStoredPlans(); }
  };

  const rejectPlan = async (id: string) => {
    const { error } = await supabase.from('strategic_plans').update({ status: 'rejected' }).eq('id', id);
    if (error) message.error(error.message);
    else { message.success('Rejeitado'); loadStoredPlans(); }
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from('strategic_plans').delete().eq('id', id);
    if (error) message.error(error.message);
    else { message.success('Excluído'); loadStoredPlans(); }
  };

  // ---- Table columns ----

  const tabs = [
    { key: 'pending' as const, label: 'Aguardando', icon: <FiClock />, count: pendingPlans.length, color: '#f59e0b' },
    { key: 'approved' as const, label: 'Aprovados', icon: <FiCheckCircle />, count: approvedPlans.length, color: '#af2896' },
    { key: 'import' as const, label: 'Importar XLS', icon: <FiUploadCloud />, count: parsedPlans.length, color: '#3b82f6' },
    { key: 'rejected' as const, label: 'Rejeitados', icon: <FiXCircle />, count: rejectedPlans.length, color: '#e91429' },
  ];

  const getTabData = () => {
    if (activeTab === 'pending') return pendingPlans;
    if (activeTab === 'approved') return approvedPlans;
    if (activeTab === 'rejected') return rejectedPlans;
    return [];
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Base de Conhecimento</h1>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#af2896' }}>{approvedPlans.length}</div>
          <div style={styles.statLabel}>Na base (treinados)</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{pendingPlans.length}</div>
          <div style={styles.statLabel}>Aguardando revisão</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#3b82f6' }}>{Array.from(new Set(approvedPlans.map(p => p.segment))).length}</div>
          <div style={styles.statLabel}>Segmentos cobertos</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#a855f7' }}>{approvedPlans.filter(p => p.source === 'human').length}</div>
          <div style={styles.statLabel}>Planejamentos manuais</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#0a0a0a', borderRadius: 9999, padding: 4 }}>
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={styles.tabBtn(activeTab === tab.key)}>
            <span style={{ display: 'flex', color: activeTab === tab.key ? tab.color : undefined }}>{tab.icon}</span>
            {tab.label}
            {tab.count > 0 && <span style={{ ...styles.badge(tab.color), fontSize: 10 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'import' ? (
        <div>
          <div style={{ ...styles.card, border: '2px dashed #282828', textAlign: 'center' }}>
            <Upload.Dragger accept=".xlsx,.xls" multiple showUploadList={false} beforeUpload={handleUpload} style={{ background: 'transparent', border: 'none' }}>
              <FiUploadCloud style={{ fontSize: 40, color: '#3b82f6', marginBottom: 8 }} />
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '8px 0 4px' }}>Arraste arquivos XLS aqui</p>
              <p style={{ color: '#666', fontSize: 13 }}>Ou clique para selecionar. Suporta múltiplos arquivos.</p>
            </Upload.Dragger>
          </div>

          {parsedPlans.length > 0 && (
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={styles.sectionTitle}>Fila de importação</h3>
                <Space>
                  <Button size="small" onClick={() => setParsedPlans([])} style={{ color: '#b3b3b3' }}>Limpar</Button>
                  <Button type="primary" icon={<CloudUploadOutlined />} loading={importing} onClick={importAll}
                    style={{ background: '#af2896', borderColor: '#af2896', color: '#fff', fontWeight: 700, borderRadius: 9999 }}>
                    Importar Todos ({parsedPlans.length})
                  </Button>
                </Space>
              </div>
              {importing && <Progress percent={importProgress} strokeColor="#af2896" trailColor="#282828" style={{ marginBottom: 12 }} />}
              {parsedPlans.map((plan) => (
                <div key={plan.key} style={{ ...styles.card, background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 16, padding: 14 }}>
                  <FiFileText style={{ fontSize: 24, color: '#3b82f6', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{plan.artist || plan.fileName}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={styles.badge('#af2896')}>{plan.objectives.length} obj</span>
                      <span style={styles.badge('#3b82f6')}>{plan.strategies.length} est</span>
                      <span style={styles.badge('#f59e0b')}>SWOT {plan.strengths.length + plan.weaknesses.length}</span>
                      {plan.fullContent.includes('PLANO DE AÇÃO') && <span style={styles.badge('#a855f7')}>Ações</span>}
                      {plan.fullContent.includes('FINANCEIRO') && <span style={styles.badge('#ec4899')}>Financeiro</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <Select size="small" value={plan.segment} style={{ width: 110 }} options={SEGMENTS.map(s => ({ value: s, label: s }))} onChange={(v) => updatePlanField(plan.key, 'segment', v)} />
                    <Select size="small" value={plan.artist_size} style={{ width: 100 }} options={ARTIST_SIZES} onChange={(v) => updatePlanField(plan.key, 'artist_size', v)} />
                    <Select size="small" value={plan.career_stage} style={{ width: 110 }} options={CAREER_STAGES} onChange={(v) => updatePlanField(plan.key, 'career_stage', v)} />
                    <Button size="small" type="text" icon={<EyeOutlined style={{ color: '#b3b3b3' }} />} onClick={() => setPreviewPlan(plan)} />
                    <Button size="small" type="text" icon={<DeleteOutlined style={{ color: '#e91429' }} />} onClick={() => setParsedPlans(prev => prev.filter(p => p.key !== plan.key))} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {getTabData().length === 0 ? (
            <div style={styles.emptyState}>
              <FiDatabase style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }} />
              <p>Nenhum planejamento nesta categoria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {getTabData().map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    background: '#181818',
                    borderRadius: 8,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'background .15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#282828')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#181818')}
                  onClick={() => setViewStoredPlan(plan)}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 6, background: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FiFileText style={{ color: '#b3b3b3', fontSize: 18 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {plan.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                      <span style={styles.badge('#af2896')}>{plan.segment}</span>
                      <span style={styles.badge('#3b82f6')}>{plan.artist_size}</span>
                      <span style={styles.badge('#a855f7')}>{plan.career_stage}</span>
                      <span style={{ color: '#555', fontSize: 11 }}>•</span>
                      <span style={{ color: '#666', fontSize: 11 }}>{new Date(plan.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <span style={{ ...styles.badge(plan.source === 'human' ? '#f59e0b' : '#a855f7'), marginRight: 8 }}>{plan.source}</span>
                    {plan.status === 'pending' && (
                      <>
                        <button onClick={() => approvePlan(plan.id)} title="Aprovar"
                          style={{ background: '#af289620', border: 'none', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <CheckOutlined style={{ color: '#af2896', fontSize: 14 }} />
                        </button>
                        <button onClick={() => rejectPlan(plan.id)} title="Rejeitar"
                          style={{ background: '#e9142920', border: 'none', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <CloseOutlined style={{ color: '#e91429', fontSize: 14 }} />
                        </button>
                      </>
                    )}
                    {plan.status !== 'pending' && (
                      <Popconfirm title="Excluir permanentemente?" onConfirm={() => deletePlan(plan.id)} placement="left">
                        <button title="Excluir"
                          style={{ background: '#e9142910', border: 'none', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <DeleteOutlined style={{ color: '#666', fontSize: 14 }} />
                        </button>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal (parsed) */}
      <Modal open={!!previewPlan} onCancel={() => setPreviewPlan(null)} footer={null} width={700}
        title={<span style={{ fontWeight: 700 }}>Preview: {previewPlan?.artist}</span>}
        styles={{ body: { maxHeight: 550, overflow: 'auto' } }}
      >
        {previewPlan && <PlanPreviewContent plan={previewPlan} />}
      </Modal>

      {/* View Stored Plan Modal */}
      <Modal open={!!viewStoredPlan} onCancel={() => setViewStoredPlan(null)} footer={null} width={750}
        title={<span style={{ fontWeight: 700 }}>{viewStoredPlan?.title}</span>}
        styles={{ body: { maxHeight: 600, overflow: 'auto' } }}
      >
        {viewStoredPlan && <StoredPlanDetail plan={viewStoredPlan} />}
      </Modal>
    </div>
  );
};

// ---- Sub-components ----

const PlanPreviewContent: FC<{ plan: ParsedPlan }> = ({ plan }) => (
  <div>
    {plan.vision && (
      <Section title="Visão">
        <p style={styles.modalItem}>{plan.vision}</p>
      </Section>
    )}
    {plan.mission && (
      <Section title="Missão">
        <p style={styles.modalItem}>{plan.mission}</p>
      </Section>
    )}
    {plan.values && (
      <Section title="Valores">
        <p style={styles.modalItem}>{plan.values}</p>
      </Section>
    )}
    {plan.objectives.length > 0 && (
      <Section title={`Objetivos (${plan.objectives.length})`}>
        {plan.objectives.map((o, i) => <div key={i} style={{ ...styles.modalItem, padding: '4px 0' }}>• {o}</div>)}
      </Section>
    )}
    {(plan.strengths.length > 0 || plan.weaknesses.length > 0) && (
      <Section title="Análise SWOT">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <SwotBox label="Forças" items={plan.strengths} color="#af2896" />
          <SwotBox label="Fraquezas" items={plan.weaknesses} color="#e91429" />
          <SwotBox label="Oportunidades" items={plan.opportunities} color="#3b82f6" />
          <SwotBox label="Ameaças" items={plan.threats} color="#f59e0b" />
        </div>
      </Section>
    )}
    {plan.strategies.length > 0 && (
      <Section title={`Estratégias (${plan.strategies.length})`}>
        {plan.strategies.slice(0, 10).map((s, i) => <div key={i} style={styles.strategyCard}><span style={{ color: '#b3b3b3', fontSize: 13 }}>{s}</span></div>)}
        {plan.strategies.length > 10 && <p style={{ color: '#666', fontSize: 12 }}>+ {plan.strategies.length - 10} mais</p>}
      </Section>
    )}
    {plan.fullContent.includes('PLANO DE AÇÃO') && <Section title="✓ Plano de Ação detectado"><p style={{ color: '#666', fontSize: 12 }}>Dados incluídos no conteúdo para treinamento.</p></Section>}
    {plan.fullContent.includes('FINANCEIRO') && <Section title="✓ Financeiro detectado"><p style={{ color: '#666', fontSize: 12 }}>Dados incluídos no conteúdo para treinamento.</p></Section>}
    {plan.fullContent.includes('CRONOGRAMA') && <Section title="✓ Cronograma detectado"><p style={{ color: '#666', fontSize: 12 }}>Dados incluídos no conteúdo para treinamento.</p></Section>}
  </div>
);

const StoredPlanDetail: FC<{ plan: StoredPlan }> = ({ plan }) => (
  <div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      <span style={styles.badge('#af2896')}>{plan.segment}</span>
      <span style={styles.badge('#3b82f6')}>{plan.artist_size}</span>
      <span style={styles.badge('#a855f7')}>{plan.career_stage}</span>
      <span style={styles.badge('#f59e0b')}>{plan.source}</span>
      <span style={{ color: '#666', fontSize: 12 }}>{'⭐'.repeat(plan.quality_score || 0)} • {new Date(plan.created_at).toLocaleDateString('pt-BR')}</span>
    </div>
    {plan.context_summary && <Section title="Contexto"><p style={styles.modalItem}>{plan.context_summary}</p></Section>}
    {plan.objectives && Array.isArray(plan.objectives) && plan.objectives.length > 0 && (
      <Section title={`Objetivos (${plan.objectives.length})`}>
        {plan.objectives.map((obj: any, i: number) => <div key={i} style={{ ...styles.modalItem, padding: '3px 0' }}>• {typeof obj === 'string' ? obj : obj.title || JSON.stringify(obj)}</div>)}
      </Section>
    )}
    {plan.strategies && Array.isArray(plan.strategies) && plan.strategies.length > 0 && (
      <Section title={`Estratégias (${plan.strategies.length})`}>
        {plan.strategies.slice(0, 8).map((strat: any, i: number) => (
          <div key={i} style={styles.strategyCard}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {strat.type && <Tag color="geekblue" style={{ marginRight: 4, fontSize: 10 }}>{strat.type}</Tag>}
              {strat.title || `Estratégia ${i + 1}`}
            </div>
            {strat.description && <p style={{ margin: 0, color: '#888', fontSize: 12, lineHeight: 1.5 }}>{strat.description.slice(0, 200)}{strat.description.length > 200 ? '...' : ''}</p>}
            {strat.tasks && Array.isArray(strat.tasks) && strat.tasks.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {strat.tasks.slice(0, 3).map((t: any, j: number) => (
                  <div key={j} style={{ color: '#666', fontSize: 11, padding: '1px 0' }}>→ {t.description || t.title}{t.deadline && ` (${t.deadline})`}</div>
                ))}
              </div>
            )}
          </div>
        ))}
        {plan.strategies.length > 8 && <p style={{ color: '#666', fontSize: 12 }}>+ {plan.strategies.length - 8} mais</p>}
      </Section>
    )}
    {plan.full_content && (
      <details style={{ marginTop: 16, cursor: 'pointer' }}>
        <summary style={{ color: '#b3b3b3', fontSize: 13, fontWeight: 600 }}>Ver conteúdo completo para RAG ({(plan.full_content.length / 1000).toFixed(1)}k chars)</summary>
        <pre style={{ marginTop: 8, padding: 12, background: '#0a0a0a', borderRadius: 8, fontSize: 11, color: '#888', whiteSpace: 'pre-wrap', maxHeight: 250, overflow: 'auto' }}>{plan.full_content}</pre>
      </details>
    )}
  </div>
);

const Section: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={styles.modalSection}>
    <div style={styles.modalSectionTitle}>{title}</div>
    {children}
  </div>
);

const SwotBox: FC<{ label: string; items: string[]; color: string }> = ({ label, items, color }) => (
  <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 10 }}>
    <div style={{ color, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{label} ({items.length})</div>
    {items.slice(0, 5).map((item, i) => <div key={i} style={{ color: '#999', fontSize: 11, padding: '2px 0' }}>• {item}</div>)}
    {items.length > 5 && <div style={{ color: '#555', fontSize: 10 }}>+ {items.length - 5} mais</div>}
  </div>
);

export default KnowledgeBase;
