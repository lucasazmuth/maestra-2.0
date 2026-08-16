import type { FC, ReactNode } from 'react';
import { Input, Popover } from 'antd';
import { FiCheck, FiSearch, FiSliders } from 'react-icons/fi';

import styles from './FilterToolbar.module.scss';

interface FilterToolbarProps {
  // 'none': quem faz a busca por texto é o campo do topo. Sobra para a barra só o que ela
  // sabe fazer melhor — status, gênero, responsável, ordenação.
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchPlacement?: 'toolbar' | 'popover' | 'none';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeCount?: number;
  onClear?: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

interface FilterSectionProps {
  label: string;
  children: ReactNode;
}

interface FilterOptionProps {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export const FilterToolbar: FC<FilterToolbarProps> = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Buscar',
  searchPlacement = 'toolbar',
  open,
  onOpenChange,
  activeCount = 0,
  onClear,
  title = 'Filtros',
  subtitle = 'Refine a lista',
  children,
  className,
}) => (
  <div
    className={[
      styles.toolbar,
      searchPlacement === 'popover' ? styles.toolbarCompact : '',
      className,
    ].filter(Boolean).join(' ')}
  >
    {searchPlacement === 'toolbar' && (
      <Input
        className={styles.search}
        prefix={<FiSearch aria-hidden="true" />}
        placeholder={searchPlaceholder}
        value={searchValue}
        allowClear
        onChange={(event) => onSearchChange?.(event.target.value)}
      />
    )}
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      overlayClassName={styles.popoverOverlay}
      content={
        <div className={styles.popover} role="dialog" aria-label={title}>
          <div className={styles.popoverHeader}>
            <div>
              <strong>{title}</strong>
              <span>{subtitle}</span>
            </div>
            {!!activeCount && onClear && (
              <button type="button" className={styles.clearButton} onClick={onClear}>
                Limpar
              </button>
            )}
          </div>
          {searchPlacement === 'popover' && (
            <div className={styles.popoverSearch}>
              <Input
                className={styles.search}
                prefix={<FiSearch aria-hidden="true" />}
                placeholder={searchPlaceholder}
                value={searchValue}
                allowClear
                autoFocus
                onChange={(event) => onSearchChange?.(event.target.value)}
              />
            </div>
          )}
          {children}
        </div>
      }
    >
      <button
        type="button"
        className={open || activeCount ? styles.filterButtonActive : styles.filterButton}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <FiSliders aria-hidden="true" />
        <span>Filtros</span>
        {!!activeCount && <span className={styles.filterCount}>{activeCount}</span>}
      </button>
    </Popover>
  </div>
);

export const FilterSection: FC<FilterSectionProps> = ({ label, children }) => (
  <section className={styles.filterSection}>
    <span className={styles.filterLabel}>{label}</span>
    {children}
  </section>
);

export const FilterChips: FC<{ children: ReactNode }> = ({ children }) => (
  <div className={styles.filterChips}>{children}</div>
);

export const FilterChip: FC<FilterOptionProps> = ({ selected = false, onClick, children }) => (
  <button
    type="button"
    className={selected ? styles.filterChipActive : styles.filterChip}
    aria-pressed={selected}
    onClick={onClick}
  >
    {children}
  </button>
);

export const FilterSortList: FC<{ children: ReactNode }> = ({ children }) => (
  <div className={styles.sortList}>{children}</div>
);

export const FilterSortOption: FC<FilterOptionProps> = ({ selected = false, onClick, children }) => (
  <button
    type="button"
    className={selected ? styles.sortOptionActive : styles.sortOption}
    aria-pressed={selected}
    onClick={onClick}
  >
    <span>{children}</span>
    {selected && <FiCheck aria-hidden="true" />}
  </button>
);
