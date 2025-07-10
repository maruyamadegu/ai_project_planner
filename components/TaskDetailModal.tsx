import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ProjectTask, EditableExtendedTaskDetails, SubStep, ActionItem, SubStepStatus, NumericalTarget, NumericalTargetStatus, Decision, SlideDeck, Attachment } from '../types';
import { XIcon, NotesIcon, ResourcesIcon, ResponsibleIcon, SubtaskIcon, PlusCircleIcon, TrashIcon, SparklesIcon, PresentationChartBarIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, ClipboardDocumentListIcon, LightBulbIcon, CheckSquareIcon, SquareIcon, ClockIcon, PaperClipIcon, CalendarIcon, GaugeIcon, UploadIcon } from './icons';
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
  const [draggedSubStep, setDraggedSubStep] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

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

  // SubStep handlers
  const handleAddSubStep = useCallback(() => {
    if (!canEdit) return;
    const newSubStep: SubStep = {
      id: generateUniqueId('substep'),
      text: '新しいサブステップ',
      notes: '',
      position: { x: 50, y: 50 },
      actionItems: [],
      attachments: []
    };
    updateLocalDetails({ subSteps: [...localDetails.subSteps, newSubStep] });
  }, [canEdit, generateUniqueId, localDetails.subSteps, updateLocalDetails]);

  const handleUpdateSubStep = useCallback((subStepId: string, updates: Partial<SubStep>) => {
    if (!canEdit) return;
    const updatedSubSteps = localDetails.subSteps.map(ss => 
      ss.id === subStepId ? { ...ss, ...updates } : ss
    );
    updateLocalDetails({ subSteps: updatedSubSteps });
  }, [canEdit, localDetails.subSteps, updateLocalDetails]);

  const handleRemoveSubStep = useCallback((subStepId: string) => {
    if (!canEdit) return;
    if (confirm('このサブステップを削除しますか？')) {
      const updatedSubSteps = localDetails.subSteps.filter(ss => ss.id !== subStepId);
      updateLocalDetails({ subSteps: updatedSubSteps });
    }
  }, [canEdit, localDetails.subSteps, updateLocalDetails]);

  // Action Item handlers
  const handleAddActionItem = useCallback((subStepId: string) => {
    if (!canEdit) return;
    const newActionItem: ActionItem = {
      id: generateUniqueId('action'),
      text: '新しいアクションアイテム',
      completed: false
    };
    
    const updatedSubSteps = localDetails.subSteps.map(ss => {
      if (ss.id === subStepId) {
        return {
          ...ss,
          actionItems: [...(ss.actionItems || []), newActionItem]
        };
      }
      return ss;
    });
    
    updateLocalDetails({ subSteps: updatedSubSteps });
  }, [canEdit, generateUniqueId, localDetails.subSteps, updateLocalDetails]);

  const handleUpdateActionItem = useCallback((subStepId: string, actionItemId: string, updates: Partial<ActionItem>) => {
    if (!canEdit) return;
    const updatedSubSteps = localDetails.subSteps.map(ss => {
      if (ss.id === subStepId) {
        return {
          ...ss,
          actionItems: ss.actionItems?.map(ai => 
            ai.id === actionItemId ? { ...ai, ...updates } : ai
          ) || []
        };
      }
      return ss;
    });
    updateLocalDetails({ subSteps: updatedSubSteps });
  }, [canEdit, localDetails.subSteps, updateLocalDetails]);

  const handleRemoveActionItem = useCallback((subStepId: string, actionItemId: string) => {
    if (!canEdit) return;
    if (confirm('このアクションアイテムを削除しますか？')) {
      const updatedSubSteps = localDetails.subSteps.map(ss => {
        if (ss.id === subStepId) {
          return {
            ...ss,
            actionItems: ss.actionItems?.filter(ai => ai.id !== actionItemId) || []
          };
        }
        return ss;
      });
      updateLocalDetails({ subSteps: updatedSubSteps });
    }
  }, [canEdit, localDetails.subSteps, updateLocalDetails]);

  // File handling
  const handleAttachmentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB未満のファイルを選択してください。`);
      if (event.target) event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        const newAttachment: Attachment = {
          id: generateUniqueId('attach'),
          name: file.name,
          type: file.type,
          dataUrl: e.target.result,
        };
        updateLocalDetails({ 
          attachments: [...(localDetails.attachments || []), newAttachment]
        });
      }
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  }, [canEdit, generateUniqueId, localDetails.attachments, updateLocalDetails]);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    if (!canEdit) return;
    updateLocalDetails({
      attachments: localDetails.attachments?.filter(a => a.id !== attachmentId) || []
    });
  }, [canEdit, localDetails.attachments, updateLocalDetails]);

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

  // Drag and drop handlers
  const handleSubStepDragStart = useCallback((subStepId: string, event: React.DragEvent) => {
    if (!canEdit) return;
    setDraggedSubStep(subStepId);
    event.dataTransfer.effectAllowed = 'move';
  }, [canEdit]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }, []);

  const handleCanvasDrop = useCallback((event: React.DragEvent) => {
    if (!canEdit || !draggedSubStep || !canvasRef.current) return;
    
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const newPosition = {
      x: event.clientX - rect.left - 100, // Offset for card center
      y: event.clientY - rect.top - 50
    };

    handleUpdateSubStep(draggedSubStep, { position: newPosition });
    setDraggedSubStep(null);
  }, [canEdit, draggedSubStep, handleUpdateSubStep]);

  // Tab renderers
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

      {/* Attachments Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold text-slate-700 flex items-center">
            <PaperClipIcon className="w-5 h-5 mr-2 text-blue-600" />
            添付ファイル
          </label>
          {canEdit && (
            <div>
              <button
                onClick={() => attachmentInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                <UploadIcon className="w-4 h-4" />
                ファイル追加
              </button>
              <input
                type="file"
                ref={attachmentInputRef}
                onChange={handleAttachmentChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {localDetails.attachments?.map(attachment => (
            <div key={attachment.id} className="relative group border rounded-lg overflow-hidden bg-slate-50 hover:bg-slate-100">
              <a
                href={attachment.dataUrl}
                download={attachment.name}
                className="block p-3 text-center"
              >
                {attachment.type.startsWith('image/') ? (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="w-full h-20 object-cover rounded mb-2"
                  />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center bg-slate-200 rounded mb-2">
                    <PaperClipIcon className="w-8 h-8 text-slate-500" />
                  </div>
                )}
                <p className="text-xs text-slate-600 truncate" title={attachment.name}>
                  {attachment.name}
                </p>
              </a>
              {canEdit && (
                <button
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSubStepsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-slate-800">サブステップ管理</h4>
        <div className="flex items-center gap-3">
          {canEdit && (
            <>
              <button
                onClick={handleGenerateProposals}
                disabled={isGeneratingProposals}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-slate-400"
              >
                {isGeneratingProposals ? <LoadingSpinner size="sm" color="border-white" /> : <SparklesIcon className="w-4 h-4" />}
                AIで提案
              </button>
              <button
                onClick={handleAddSubStep}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                <PlusCircleIcon className="w-4 h-4" />
                手動追加
              </button>
            </>
          )}
          <button
            onClick={() => setShowActionItemTable(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
          >
            <ClipboardDocumentListIcon className="w-4 h-4" />
            アクション一覧
          </button>
        </div>
      </div>

      {proposalError && <ErrorMessage message={proposalError} />}

      {/* Canvas for SubSteps */}
      <div
        ref={canvasRef}
        className="relative border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 overflow-auto"
        style={{ 
          height: localDetails.subStepCanvasSize?.height || 600,
          minHeight: 400
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDrop}
        onMouseMove={handleCanvasMouseMove}
      >
        {localDetails.subSteps.map(subStep => (
          <div
            key={subStep.id}
            draggable={canEdit}
            onDragStart={(e) => handleSubStepDragStart(subStep.id, e)}
            className="absolute bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-move"
            style={{
              left: subStep.position?.x || 0,
              top: subStep.position?.y || 0,
              width: 280,
              minHeight: 120
            }}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <input
                  type="text"
                  value={subStep.text}
                  onChange={(e) => handleUpdateSubStep(subStep.id, { text: e.target.value })}
                  disabled={!canEdit}
                  className="font-semibold text-slate-800 bg-transparent border-none outline-none flex-grow text-sm"
                />
                {canEdit && (
                  <button
                    onClick={() => handleRemoveSubStep(subStep.id)}
                    className="p-1 text-red-500 hover:text-red-700 rounded"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              <textarea
                value={subStep.notes || ''}
                onChange={(e) => handleUpdateSubStep(subStep.id, { notes: e.target.value })}
                disabled={!canEdit}
                placeholder="詳細説明..."
                className="w-full text-xs text-slate-600 bg-transparent border-none outline-none resize-none"
                rows={2}
              />

              <div className="mt-3 space-y-1">
                {subStep.actionItems?.map(actionItem => (
                  <div key={actionItem.id} className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => handleUpdateActionItem(subStep.id, actionItem.id, { completed: !actionItem.completed })}
                      disabled={!canEdit}
                      className="flex-shrink-0"
                    >
                      {actionItem.completed ? 
                        <CheckSquareIcon className="w-4 h-4 text-green-600" /> : 
                        <SquareIcon className="w-4 h-4 text-slate-400" />
                      }
                    </button>
                    <input
                      type="text"
                      value={actionItem.text}
                      onChange={(e) => handleUpdateActionItem(subStep.id, actionItem.id, { text: e.target.value })}
                      disabled={!canEdit}
                      className="flex-grow bg-transparent border-none outline-none text-slate-700"
                    />
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveActionItem(subStep.id, actionItem.id)}
                        className="p-0.5 text-red-500 hover:text-red-700"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                
                {canEdit && (
                  <button
                    onClick={() => handleAddActionItem(subStep.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                  >
                    <PlusCircleIcon className="w-3 h-3" />
                    アクション追加
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {localDetails.subSteps.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <SubtaskIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>サブステップがありません</p>
              <p className="text-sm">「AIで提案」または「手動追加」でサブステップを作成してください</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDecisionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-slate-800">決定事項管理</h4>
        {canEdit && (
          <button
            onClick={() => setShowDecisionModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <LightBulbIcon className="w-4 h-4" />
            決定事項を管理
          </button>
        )}
      </div>

      <div className="space-y-3">
        {localDetails.decisions?.map(decision => (
          <div key={decision.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-grow">
                <h5 className="font-medium text-slate-800">{decision.question}</h5>
                {decision.status === 'decided' && decision.decision && (
                  <p className="text-sm text-green-700 mt-1">
                    <strong>決定:</strong> {decision.decision}
                  </p>
                )}
                {decision.reasoning && (
                  <p className="text-sm text-slate-600 mt-1">{decision.reasoning}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  decision.status === 'decided' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {decision.status === 'decided' ? '決定済み' : '未決定'}
                </span>
                {decision.date && (
                  <span className="text-xs text-slate-500">{decision.date}</span>
                )}
              </div>
            </div>
          </div>
        )) || []}

        {(!localDetails.decisions || localDetails.decisions.length === 0) && (
          <div className="text-center py-8 text-slate-500">
            <LightBulbIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>決定事項がありません</p>
            <p className="text-sm">「決定事項を管理」ボタンから追加してください</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-slate-800">レポート・資料</h4>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCustomReportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            <SparklesIcon className="w-4 h-4" />
            カスタムレポート
          </button>
          <button
            onClick={handleGenerateSlides}
            disabled={isGeneratingSlides}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400"
          >
            {isGeneratingSlides ? <LoadingSpinner size="sm" color="border-white" /> : <PresentationChartBarIcon className="w-4 h-4" />}
            {localDetails.reportDeck ? 'スライド編集' : 'スライド生成'}
          </button>
        </div>
      </div>

      {slideError && <ErrorMessage message={slideError} />}

      {localDetails.reportDeck && (
        <div className="border border-slate-200 rounded-lg p-4">
          <h5 className="font-medium text-slate-800 mb-2">タスクレポートスライド</h5>
          <p className="text-sm text-slate-600 mb-3">
            {localDetails.reportDeck.slides.length} スライドが作成されています
          </p>
          <button
            onClick={() => setIsSlideEditorOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
          >
            <PresentationChartBarIcon className="w-4 h-4" />
            スライドを編集
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-lg p-4">
          <h5 className="font-medium text-slate-800 mb-2">進捗サマリー</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>サブステップ数:</span>
              <span>{localDetails.subSteps.length}</span>
            </div>
            <div className="flex justify-between">
              <span>アクションアイテム数:</span>
              <span>{flattenedActionItems.length}</span>
            </div>
            <div className="flex justify-between">
              <span>完了済みアクション:</span>
              <span>{flattenedActionItems.filter(item => item.actionItem.completed).length}</span>
            </div>
            <div className="flex justify-between">
              <span>決定事項:</span>
              <span>{localDetails.decisions?.length || 0}</span>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4">
          <h5 className="font-medium text-slate-800 mb-2">最近のアクティビティ</h5>
          <div className="space-y-2 text-sm text-slate-600">
            {flattenedActionItems
              .filter(item => item.actionItem.completed && item.actionItem.completedDate)
              .slice(0, 3)
              .map(item => (
                <div key={item.actionItem.id} className="flex items-center gap-2">
                  <CheckSquareIcon className="w-4 h-4 text-green-600" />
                  <span className="truncate">{item.actionItem.text}</span>
                </div>
              ))}
            {flattenedActionItems.filter(item => item.actionItem.completed).length === 0 && (
              <p className="text-slate-500">完了したアクションアイテムはありません</p>
            )}
          </div>
        </div>
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
            {activeTab === 'substeps' && renderSubStepsTab()}
            {activeTab === 'decisions' && renderDecisionsTab()}
            {activeTab === 'reports' && renderReportsTab()}
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