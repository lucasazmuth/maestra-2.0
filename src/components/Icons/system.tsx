import { FC, SVGProps } from 'react';

// Ícones do sistema (fornecidos pelo design). As cores foram trocadas por currentColor, então cada
// ícone herda a cor do contexto (ativo/hover). O viewBox é cropado pra o traço (centrado no box 41)
// renderizar no tamanho pedido, como os ícones antigos do Feather.

import { ReactComponent as DashboardSvg } from '../../assets/icons/dashboard.svg';
import { ReactComponent as DiagnosticoSvg } from '../../assets/icons/diagnostico.svg';
import { ReactComponent as PlanejamentoSvg } from '../../assets/icons/planejamento.svg';
import { ReactComponent as PlanoAcaoSvg } from '../../assets/icons/plano-acao.svg';
import { ReactComponent as CatalogoSvg } from '../../assets/icons/catalogo.svg';
import { ReactComponent as EquipeSvg } from '../../assets/icons/equipe.svg';
import { ReactComponent as ArtistasSvg } from '../../assets/icons/artistas.svg';
import { ReactComponent as HomeSvg } from '../../assets/icons/home.svg';
import { ReactComponent as NotificationSvg } from '../../assets/icons/notification.svg';
import { ReactComponent as ConfigSvg } from '../../assets/icons/config.svg';
import { ReactComponent as BuscarSvg } from '../../assets/icons/buscar.svg';
import { ReactComponent as FiltroSvg } from '../../assets/icons/filtro.svg';
import { ReactComponent as ListaSvg } from '../../assets/icons/lista.svg';
import { ReactComponent as ReordenarSvg } from '../../assets/icons/reordenar.svg';
import { ReactComponent as AddSvg } from '../../assets/icons/add.svg';
import { ReactComponent as MoreSvg } from '../../assets/icons/more.svg';
import { ReactComponent as UploadSvg } from '../../assets/icons/upload.svg';
import { ReactComponent as DownloadSvg } from '../../assets/icons/download.svg';
import { ReactComponent as EditSvg } from '../../assets/icons/edit.svg';
import { ReactComponent as AgendaSvg } from '../../assets/icons/agenda.svg';
import { ReactComponent as FiltrosSvg } from '../../assets/icons/filtros.svg';

// Avatar colorido da Nyta (imagem, não traço): importado como URL.
export { default as nytaAvatar } from '../../assets/icons/nyta-avatar.svg';

type SvgComp = FC<SVGProps<SVGSVGElement>>;
type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'viewBox'>;

// Crop padrão (traço ocupa ~6..35 do box 41). lista/add/catálogo têm "moldura" → crop mais largo.
const make = (Svg: SvgComp, viewBox = '6 6 29 29'): FC<IconProps> => ({ size = 22, ...rest }) => (
  <Svg viewBox={viewBox} width={size} height={size} {...rest} />
);

export const DashboardIcon = make(DashboardSvg);
export const DiagnosticoIcon = make(DiagnosticoSvg);
export const PlanejamentoIcon = make(PlanejamentoSvg);
export const PlanoAcaoIcon = make(PlanoAcaoSvg);
export const CatalogoIcon = make(CatalogoSvg, '4 4 33 33');
export const EquipeIcon = make(EquipeSvg, '4 6 33 29');
export const ArtistasIcon = make(ArtistasSvg);
export const SystemHomeIcon = make(HomeSvg);
export const NotificationIcon = make(NotificationSvg);
export const ConfigIcon = make(ConfigSvg, '6 6 30 30');
export const BuscarIcon = make(BuscarSvg);
export const FiltroIcon = make(FiltroSvg);
export const ListaIcon = make(ListaSvg, '4 4 33 33');
export const ReordenarIcon = make(ReordenarSvg, '6 10 30 19');
export const AddIcon = make(AddSvg, '10 10 21 21');
export const MoreIcon = make(MoreSvg, '8 16 25 9');
export const UploadIcon = make(UploadSvg);
export const DownloadIcon = make(DownloadSvg);
export const EditIcon = make(EditSvg, '9 7 24 24');
export const AgendaIcon = make(AgendaSvg);
export const FiltrosIcon = make(FiltrosSvg, '7 9 28 28');
