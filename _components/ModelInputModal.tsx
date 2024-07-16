import React, { useState, useRef } from "react";
import useLocalStorage from "_hooks/useLocalStorage";

interface ModelInputModalProps {
    models: string[];
    setModels: React.Dispatch<React.SetStateAction<string[]>>;
    isModalOpen: boolean;
    closeModal: () => void;
}

interface FunctionCall {
    title: string;
    code: {
        name: string;
        description: string;
        parameters: any;
        function: string;
        resultTemplate: string;
    };
}

export default function ModelInputModal({ models, setModels, isModalOpen, closeModal }: ModelInputModalProps) {
    const [newModel, setNewModel] = useState<string>('');
    const [newFunctionCall, setNewFunctionCall] = useState<FunctionCall>({ title: '', code: '' });
    const [functionCalls, setFunctionCalls] = useLocalStorage<FunctionCall[]>('functionCalls', [
        {
            title: "get_current_weather",
            code: {
                name: "get_current_weather",
                description: "現在の天気を取得する",
                parameters: {
                    type: "object",
                    properties: {
                        location: {
                            type: "string",
                            description: "場所（例：東京）"
                        },
                        unit: {
                            type: "string",
                            enum: ["celsius", "fahrenheit"],
                            description: "温度の単位",
                            default: "celsius"
                        }
                    },
                    required: ["location"]
                },
                function: "function getCurrentWeather(location, unit = 'celsius') {\n  // ここに天気を取得するロジックを記述\n  // 例：\n  return {\n    location,\n    temperature: 20,\n    unit,\n    weather: '晴れ'\n  };\n}",
                resultTemplate: "{{location}}の現在の天気:\n気温: {{temperature}}{{#if unit == 'celsius'}}°C{{else}}°F{{/if}}\n天気: {{weather}}"
            }
        }
    ]);
    const [draggedModel, setDraggedModel] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragOverLineRef = useRef<HTMLDivElement>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingFunctionCall, setEditingFunctionCall] = useState<FunctionCall>({ title: '', code: '' });

    const handleAddModel = () => {
        if (newModel && !models.includes(newModel)) {
            setModels([...models, newModel]);
            setNewModel('');
        }
    };

    const handleAddFunctionCall = () => {
        if (newFunctionCall.title && newFunctionCall.code) {
            try {
                // 入力されたコードが有効なJSONかチェック
                const parsedCode = JSON.parse(newFunctionCall.code);
                setFunctionCalls([...functionCalls, {
                    title: newFunctionCall.title,
                    code: parsedCode
                }]);
                setNewFunctionCall({ title: '', code: '' });
            } catch (error) {
                console.error('Invalid JSON:', error);
                alert('入力されたコードが有効なJSONではありません。');
            }
        }
    };

    const handleDeleteModel = (modelToDelete: string) => {
        setModels(models.filter(model => model !== modelToDelete));
    };

    const handleDeleteFunctionCall = (index: number) => {
        setFunctionCalls(functionCalls.filter((_, i) => i !== index));
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAddModel();
        }
    };

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, model: string) => {
        setDraggedModel(model);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLLIElement>, targetModel: string) => {
        e.preventDefault();
        if (draggedModel) {
            const draggedIndex = models.indexOf(draggedModel);
            const targetIndex = models.indexOf(targetModel);
            const updatedModels = [...models];
            updatedModels.splice(draggedIndex, 1);
            updatedModels.splice(targetIndex, 0, draggedModel);
            setModels(updatedModels);
            setDraggedModel(null);
            setDragOverIndex(null);
        }
    };

    const handleEditFunctionCall = (index: number) => {
        setEditingIndex(index);
        setEditingFunctionCall(functionCalls[index]);
    };

    const handleSaveEditedFunctionCall = () => {
        if (editingIndex !== null) {
            const updatedFunctionCalls = [...functionCalls];
            updatedFunctionCalls[editingIndex] = editingFunctionCall;
            setFunctionCalls(updatedFunctionCalls);
            setEditingIndex(null);
            setEditingFunctionCall({ title: '', code: '' });
        }
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingFunctionCall({ title: '', code: '' });
    };

    if (!isModalOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content">
                <button className="close-button" onClick={closeModal}>&times;</button>
                <h2>Model Settings</h2>
                <ul className="model-list">
                    {models.map((model, index) => (
                        <li
                            key={index}
                            draggable
                            onDragStart={(e) => handleDragStart(e, model)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, model)}
                        >
                            {dragOverIndex === index && <div ref={dragOverLineRef} className="drag-over-line"></div>}
                            <span className="model-name">{model}</span>
                            <button onClick={() => handleDeleteModel(model)} className="delete-button">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="input-area">
                    <input
                        type="text"
                        value={newModel}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewModel(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Add new model"
                        className="model-input"
                    />
                    <button onClick={handleAddModel} className="add-button">Add</button>
                </div>
                <h2>Function Calls</h2>
                <ul className="function-call-list">
                    {functionCalls.map((func, index) => (
                        <li key={index}>
                            {editingIndex === index ? (
                                <div className="function-edit">
                                    <input
                                        type="text"
                                        value={editingFunctionCall.title}
                                        onChange={(e) => setEditingFunctionCall({ ...editingFunctionCall, title: e.target.value })}
                                        className="function-input"
                                        placeholder="Function title"
                                    />
                                    <textarea
                                        value={editingFunctionCall.code}
                                        onChange={(e) => setEditingFunctionCall({ ...editingFunctionCall, code: e.target.value })}
                                        className="function-input"
                                        placeholder="Function code"
                                    />
                                    <div className="function-edit-buttons">
                                        <button onClick={handleSaveEditedFunctionCall} className="save-button">保存</button>
                                        <button onClick={handleCancelEdit} className="cancel-button">キャンセル</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className="function-title">{func.title}</span>
                                    <div className="function-buttons">
                                        <button onClick={() => handleEditFunctionCall(index)} className="edit-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button onClick={() => handleDeleteFunctionCall(index)} className="delete-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
                {editingIndex === null && (
                    <div className="function-input-area">
                        <input
                            type="text"
                            value={newFunctionCall.title}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFunctionCall({ ...newFunctionCall, title: e.target.value })}
                            placeholder="Function Name"
                            className="function-input"
                        />
                        <textarea
                            value={newFunctionCall.code}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewFunctionCall({ ...newFunctionCall, code: e.target.value })}
                            placeholder="Function Code"
                            className="function-input"
                        />
                        <button onClick={handleAddFunctionCall} className="add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Function
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
}
