import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

// O idioma das datas.
//
// O dayjs nasce em inglês, e a Agenda escreve o mês e o dia da semana por extenso — sem isto
// aparece "29 de August de 2026". A web faz o mesmo no `src/index.tsx`; aqui precisa ser no
// entry do app, e não numa tela, porque a formatação acontece na primeira renderização.
dayjs.locale('pt-br');
