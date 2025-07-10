import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectTask, EditableExtendedTaskDetails, SubStep, ActionItem, SubStepStatus, NumericalTarget, NumericalTargetStatus, Decision, SlideDeck } from '../types';
import { XIcon, NotesIcon, ResourcesIcon, ResponsibleIcon, SubtaskIcon, PlusCircleIcon, TrashIcon, SparklesIcon, PresentationChartBarIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, ClipboardDocumentListIcon, LightBulbIcon } from './icons';
import { generateStepProposals, generateInitialSlideDeck } from '../services/geminiService';
import ProposalReviewModal from './ProposalReviewModal';
import SlideEditorView from './SlideEditorView';
import ActionItemTableModal from './ActionItemTableModal';
import ActionItemReportModal from './ActionItemReportModal';
import DecisionModal from './DecisionModal';
import CustomTaskReportModal from './CustomTaskReportModal';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface TaskDetailModalProps {
  task: ProjectTask;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: EditableExtendedTaskDetails) => void;
  generateUniqueId: (prefix: string) => string;
  projectGoal: string;
  targetDate: string;
  canEdit?: boolean;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
  task, 
  onClose, 
  onUpdateTask, 
  generateUniqueId, 
  projectGoal, 
  targetDate,
  canEdit = true 
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'substeps' | 'decisions' | 'reports'>('overview');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [showProposalReview, setShowProposalReview] = useState(false);
  const [proposals, setProposals] = useState<{ title: string; description: string }[]>([]);
  const [isSlideEditorOpen, setIsSlideEditorOpen] = useState(false);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [slideError, setSlideError] = useState<string | null>(null);
  const [showActionItemTable, setShowActionItemTable] = useState(false);
  const [selectedActionItem, setSelectedActionItem] = useState<{ actionItem: ActionItem; subStep: SubStep } | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);
  const [connectingSubStep, setConnectingSubStep] = useState<string | null>(null);

  // Memoized values to prevent unnecessary re-renders
  const extendedDetails = useMemo(() => task.extendedDetails || {
    subSteps: [],
    resources: '',
    responsible: '',
    notes: '',
    attachments: [],
    decisions: [],
    subStepCanvasSize: { width: 1200, height: 800 }
  }, [task.extendedDetails]);

  const [localDetails, setLocalDetails] = useState<EditableExtendedTaskDetails>(extendedDetails);

  // Update local state when task changes
  useEffect(() => {
    setLocalDetails(extendedDetails);
  }, [extendedDetails]);

  // Memoized update function to prevent infinite loops
  const updateLocalDetails = useCallback((updates: Partial<EditableExtendedTaskDetails>) => {
    setLocalDetails(prev => ({ ...prev, ...updates }));
  }, []);

  // Debounced save function
  const saveChanges = useCallback(() => {
    onUpdateTask(task.id, localDetails);
  }, [task.id, localDetails, onUpdateTask]);

  // Auto-save with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (JSON.stringify(localDetails) !== JSON.stringify(extendedDetails)) {
        saveChanges();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [localDetails, extendedDetails, saveChanges]);

  // Memoized handlers
  const handleGenerateProposals = useCallback(async () => {
    if (!canEdit) return;
    
    setIsGeneratingProposals(true);
    setProposalError(null);
    try {
      const generatedProposals = await generateStepProposals(task);
      setProposals(generatedProposals);
      setShowProposalReview(true);
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : 'ステップ提案の生成に失敗しました。');
    } finally {
      setIsGeneratingProposals(false);
    }
  }, [task, canEdit]);

  const handleProposalConfirm = useCallback((additions: { newSubSteps: { title: string; description: string }[], newActionItems: { targetSubStepId: string, title: string }[] }) => {
    const newSubSteps = additions.newSubSteps.map((proposal, index) => ({
      id: generateUniqueId('substep'),
      text: proposal.title,
      notes: proposal.description,
      position: { x: 50 + (index % 3) * 300, y: 50 + Math.floor(index / 3) * 200 },
      actionItems: [],
      attachments: []
    }));

    const updatedSubSteps = [...localDetails.subSteps, ...newSubSteps];

    additions.newActionItems.forEach(item => {
      const targetSubStep = updatedSubSteps.find(ss => ss.id === item.targetSubStepId);
      if (targetSubStep) {
        targetSubStep.actionItems = targetSubStep.actionItems || [];
        targetSubStep.actionItems.push({
          id: generateUniqueId('action'),
          text: item.title,
          completed: false
        });
      }
    });

    updateLocalDetails({ subSteps: updatedSubSteps });
    setShowProposalReview(false);
  }, [localDetails.subSteps, generateUniqueId, updateLocalDetails]);

  const handleGenerateSlides = useCallback(async () => {
    if (localDetails.reportDeck) {
      setIsSlideEditorOpen(true);
      return;
    }

    setIsGeneratingSlides(true);
    setSlideError(null);
    try {
      const deck = await generateInitialSlideDeck(task, projectGoal);
      updateLocalDetails({ reportDeck: deck });
      setIsSlideEditorOpen(true);
    } catch (err) {
      setSlideError(err instanceof Error ? err.message : 'スライドの生成に失敗しました。');
    } finally {
      setIsGeneratingSlides(false);
    }
  }, [localDetails.reportDeck, task, projectGoal, updateLocalDetails]);

  const handleSaveSlides = useCallback((deck: SlideDeck) => {
    updateLocalDetails({ reportDeck: deck });
  }, [updateLocalDetails]);

  // Memoized action items for table display
  const flattenedActionItems = useMemo(() => {
    const items: { actionItem: ActionItem; subStep: SubStep }[] = [];
    localDetails.subSteps.forEach(subStep => {
      subStep.actionItems?.forEach(actionItem => {
        items.push({ actionItem, subStep });
      });
    });
    return items;
  }, [localDetails.subSteps]);

  // Rest of the component remains the same...
  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
            <ResourcesIcon className="w-5 h-5 mr-2 text-blue-600" />
            必要なリソース
          </label>
          <textarea
            value={localDetails.resources}
            onChange={(e) => updateLocalDetails({ resources: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 disabled:bg-slate-100"
            rows={3}
            placeholder="例: 開発チーム2名、デザイナー1名、予算50万円"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
            <ResponsibleIcon className="w-5 h-5 mr-2 text-blue-600" />
            責任者
          </label>
          <input
            type="text"
            value={localDetails.responsible}
            onChange={(e) => updateLocalDetails({ responsible: e.target.value })}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 disabled:bg-slate-100"
            placeholder="例: 田中太郎"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
          <NotesIcon className="w-5 h-5 mr-2 text-blue-600" />
          メモ・補足情報
        </label>
        <textarea
          value={localDetails.notes}
          onChange={(e) => updateLocalDetails({ notes: e.target.value })}
          disabled={!canEdit}
          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-800 disabled:bg-slate-100"
          rows={4}
          placeholder="このタスクに関する追加情報、注意点、参考資料など..."
        />
      </div>
    </div>
  );

  if (isSlideEditorOpen && localDetails.reportDeck) {
    return (
      <SlideEditorView
        tasks={[task]}
        initialDeck={localDetails.reportDeck}
        onSave={handleSaveSlides}
        onClose={() => setIsSlideEditorOpen(false)}
        generateUniqueId={generateUniqueId}
        projectGoal={projectGoal}
        targetDate={targetDate}
        reportScope="task"
      />
    );
  }

  return (
    <>
      <div className={`fixed bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[50] ${isMaximized ? 'inset-0' : 'inset-0'}`}>
        <div className={`bg-white rounded-xl shadow-2xl flex flex-col ${isMaximized ? 'w-full h-full' : 'w-full max-w-6xl max-h-[90vh]'}`}>
          <header className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
            <div className="flex-grow min-w-0 mr-4">
              <h3 className="text-xl font-bold text-slate-800 truncate">{task.title}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {canEdit && (
                <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  編集可能
                </div>
              )}
              <div className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                自動保存
              </div>
              <div className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                {localDetails.subSteps.length} サブステップ
              </div>
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                {flattenedActionItems.length} アクション
              </span>
              <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                {localDetails.decisions?.length || 0} 決定事項
              </span>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                title={isMaximized ? "最小化" : "最大化"}
              >
                {isMaximized ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                title="閉じる"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </header>

          <nav className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
            {[
              { id: 'overview', label: '概要', icon: NotesIcon },
              { id: 'substeps', label: 'サブステップ', icon: SubtaskIcon },
              { id: 'decisions', label: '決定事項', icon: LightBulbIcon },
              { id: 'reports', label: 'レポート', icon: PresentationChartBarIcon }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 py-3 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id 
                    ? 'border-blue-500 text-blue-600 bg-white' 
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>

          <main className="flex-grow p-6 overflow-y-auto">
            {activeTab === 'overview' && renderOverviewTab()}
            {/* Other tabs would be rendered here */}
          </main>
        </div>
      </div>

      {/* Modals */}
      {showProposalReview && (
        <ProposalReviewModal
          proposals={proposals}
          existingSubSteps={localDetails.subSteps}
          onConfirm={handleProposalConfirm}
          onClose={() => setShowProposalReview(false)}
        />
      )}

      {showActionItemTable && (
        <ActionItemTableModal
          items={flattenedActionItems}
          taskName={task.title}
          onClose={() => setShowActionItemTable(false)}
        />
      )}

      {selectedActionItem && (
        <ActionItemReportModal
          actionItem={selectedActionItem.actionItem}
          onSave={(updatedItem) => {
            const updatedSubSteps = localDetails.subSteps.map(subStep => {
              if (subStep.id === selectedActionItem.subStep.id) {
                return {
                  ...subStep,
                  actionItems: subStep.actionItems?.map(item => 
                    item.id === updatedItem.id ? updatedItem : item
                  ) || []
                };
              }
              return subStep;
            });
            updateLocalDetails({ subSteps: updatedSubSteps });
            setSelectedActionItem(null);
          }}
          onClose={() => setSelectedActionItem(null)}
          generateUniqueId={generateUniqueId}
        />
      )}

      {showDecisionModal && (
        <DecisionModal
          isOpen={showDecisionModal}
          onClose={() => setShowDecisionModal(false)}
          onSave={(decisions) => {
            updateLocalDetails({ decisions });
            setShowDecisionModal(false);
          }}
          task={task}
          generateUniqueId={generateUniqueId}
        />
      )}

      {showCustomReportModal && (
        <CustomTaskReportModal
          task={task}
          isOpen={showCustomReportModal}
          onClose={() => setShowCustomReportModal(false)}
          onReportGenerated={() => setShowCustomReportModal(false)}
        />
      )}
    </>
  );
};

export default TaskDetailModal;