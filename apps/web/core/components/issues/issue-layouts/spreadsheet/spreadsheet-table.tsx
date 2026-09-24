/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { IIssueDisplayFilterOptions, IIssueDisplayProperties, TIssue } from "@plane/types";
// components
import { SpreadsheetIssueRowLoader } from "@/components/ui/loader/layouts/spreadsheet-layout-loader";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
// local imports
import type { TRenderQuickActions } from "../list/list-view-types";
import { getDisplayPropertiesCount } from "../utils";
import { SpreadsheetIssueRow } from "./issue-row";
import { SpreadsheetHeader } from "./spreadsheet-header";

type Props = {
  displayProperties: IIssueDisplayProperties;
  displayFilters: IIssueDisplayFilterOptions;
  handleDisplayFilterUpdate: (data: Partial<IIssueDisplayFilterOptions>) => void;
  issueIds: string[];
  isEstimateEnabled: boolean;
  quickActions: TRenderQuickActions;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  canEditProperties: (projectId: string | undefined) => boolean;
  portalElement: React.MutableRefObject<HTMLDivElement | null>;
  containerRef: MutableRefObject<HTMLTableElement | null>;
  canLoadMoreIssues: boolean;
  loadMoreIssues: () => void;
  spreadsheetColumnsList: (keyof IIssueDisplayProperties)[];
  selectionHelpers: TSelectionHelper;
  isEpic?: boolean;
};

export const SpreadsheetTable = observer(function SpreadsheetTable(props: Props) {
  const {
    displayProperties,
    displayFilters,
    handleDisplayFilterUpdate,
    issueIds,
    isEstimateEnabled,
    portalElement,
    quickActions,
    updateIssue,
    canEditProperties,
    canLoadMoreIssues,
    containerRef,
    loadMoreIssues,
    spreadsheetColumnsList,
    selectionHelpers,
    isEpic = false,
  } = props;

  // states
  const isScrolled = useRef(false);
  const [intersectionElement, setIntersectionElement] = useState<HTMLTableSectionElement | null>(null);

  const {
    issues: { getIssueLoader },
  } = useIssuesStore();
  const { issueMap } = useIssues();
  const { getStateById } = useProjectState();

  // piensaenweb: lo mismo que en la lista. Una subtarea cuya madre esta en esta
  // tabla ya se ve al desplegar la madre; pintarla tambien suelta la duplicaba.
  // Si la madre no esta (otro filtro, otra persona), sigue suelta.
  const enLaTabla = new Set(issueIds);
  // Y lo cerrado (hecho o descartado) va al final: sigue ahi para consultarlo,
  // pero no se mezcla con lo que queda por hacer. El orden de lo demas no cambia.
  const cerrada = (id: string) => {
    const grupo = getStateById(issueMap[id]?.state_id)?.group;
    return grupo === "completed" || grupo === "cancelled";
  };
  const filtradas = issueIds.filter((id) => {
    const madre = issueMap[id]?.parent_id;
    return !madre || !enLaTabla.has(madre);
  });
  const sueltas = [...filtradas.filter((id) => !cerrada(id)), ...filtradas.filter(cerrada)];

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;

    const columnShadow = "8px 22px 22px 10px rgba(0, 0, 0, 0.05)"; // shadow for regular columns
    const headerShadow = "8px -22px 22px 10px rgba(0, 0, 0, 0.05)"; // shadow for headers

    //The shadow styles are added this way to avoid re-render of all the rows of table, which could be costly
    if (scrollLeft > 0 !== isScrolled.current) {
      const firstColumns = containerRef.current.querySelectorAll("table tr td:first-child, th:first-child");

      for (let i = 0; i < firstColumns.length; i++) {
        const shadow = i === 0 ? headerShadow : columnShadow;
        if (scrollLeft > 0) {
          (firstColumns[i] as HTMLElement).style.boxShadow = shadow;
        } else {
          (firstColumns[i] as HTMLElement).style.boxShadow = "none";
        }
      }
      isScrolled.current = scrollLeft > 0;
    }
  }, [containerRef]);

  useEffect(() => {
    const currentContainerRef = containerRef.current;

    if (currentContainerRef) currentContainerRef.addEventListener("scroll", handleScroll);

    return () => {
      if (currentContainerRef) currentContainerRef.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, containerRef]);

  const isPaginating = !!getIssueLoader();

  useIntersectionObserver(containerRef, isPaginating ? null : intersectionElement, loadMoreIssues, `100% 0% 100% 0%`);

  const handleKeyBoardNavigation = useTableKeyboardNavigation();

  const ignoreFieldsForCounting: (keyof IIssueDisplayProperties)[] = ["key"];
  if (!isEstimateEnabled) ignoreFieldsForCounting.push("estimate");
  const displayPropertiesCount = getDisplayPropertiesCount(displayProperties, ignoreFieldsForCounting);

  return (
    <table className="w-full overflow-y-auto bg-surface-1" onKeyDown={handleKeyBoardNavigation}>
      <SpreadsheetHeader
        displayProperties={displayProperties}
        displayFilters={displayFilters}
        handleDisplayFilterUpdate={handleDisplayFilterUpdate}
        canEditProperties={canEditProperties}
        isEstimateEnabled={isEstimateEnabled}
        spreadsheetColumnsList={spreadsheetColumnsList}
        selectionHelpers={selectionHelpers}
        isEpic={isEpic}
      />
      <tbody>
        {sueltas.map((id) => (
          <SpreadsheetIssueRow
            key={id}
            issueId={id}
            displayProperties={displayProperties}
            quickActions={quickActions}
            canEditProperties={canEditProperties}
            nestingLevel={0}
            isEstimateEnabled={isEstimateEnabled}
            updateIssue={updateIssue}
            portalElement={portalElement}
            containerRef={containerRef}
            isScrolled={isScrolled}
            spreadsheetColumnsList={spreadsheetColumnsList}
            selectionHelpers={selectionHelpers}
            isEpic={isEpic}
          />
        ))}
      </tbody>
      {canLoadMoreIssues && (
        <tfoot ref={setIntersectionElement}>
          {Array.from({ length: 3 }).map((_, index) => (
            <SpreadsheetIssueRowLoader key={index} columnCount={displayPropertiesCount} />
          ))}
        </tfoot>
      )}
    </table>
  );
});
