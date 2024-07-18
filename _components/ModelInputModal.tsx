import React, { useState, useRef } from "react";
import useLocalStorage from "_hooks/useLocalStorage";

interface ModelInputModalProps {
    models: string[];
    setModels: (models: string[]) => void;
    isModalOpen: boolean;
    closeModal: () => void;
    tools: Tool[];
    setTools: (tools: Tool[]) => void;
    toolFunctions: Record<string, Function>;
    setToolFunctions: (toolFunctions: Record<string, Function>) => void;
}

interface Tool {
    type: string;
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

export default function ModelInputModal({ models, setModels, isModalOpen, closeModal, tools, setTools, toolFunctions, setToolFunctions }: ModelInputModalProps) {
    const [newModel, setNewModel] = useState<string>('');
    const [newTool, setNewTool] = useState<Tool>({
        type: "function",
        function: {
            name: "",
            description: "",
            parameters: {}
        }
    });
    // const [tools, setTools] = useLocalStorage<Tool[]>('tools', [
    //     {
    //         type: "function",
    //         function: {
    //             name: "get_current_weather",
    //             description: "現在の天気を取得する",
    //             parameters: {
    //                 type: "object",
    //                 properties: {
    //                     location: {
    //                         type: "string",
    //                         description: "場所（例：東京）"
    //                     },
    //                     unit: {
    //                         type: "string",
    //                         enum: ["celsius", "fahrenheit"],
    //                         description: "温度の単位",
    //                         default: "celsius"
    //                     }
    //                 },
    //                 required: ["location"]
    //             }
    //         }
    //     }
    // ]);
    // const [toolFunctions, setToolFunctions] = useLocalStorage<Record<string, Function>>('toolFunctions', {
    //     get_current_weather: (args: any) => {
    //         const { location = "Tokyo", unit = "celsius" } = args;
    //         const randomTemperature = () => (Math.random() * 40 - 10).toFixed(1);
    //         const randomWeather = () => {
    //             const weatherConditions = ["晴れ", "曇り", "雨", "雪"];
    //             return weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
    //         };

    //         const temperature = randomTemperature();
    //         const weather = randomWeather();

    //         return {
    //             location,
    //             temperature: unit === "fahrenheit" ? (parseFloat(temperature) * 9 / 5 + 32).toFixed(1) : temperature,
    //             unit,
    //             weather
    //         };
    //     }
    // });
    const [draggedModel, setDraggedModel] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const dragOverLineRef = useRef<HTMLDivElement>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingTool, setEditingTool] = useState<Tool>({
        type: "function",
        function: {
            name: "",
            description: "",
            parameters: {}
        }
    });
    const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
    const [editingModel, setEditingModel] = useState<string>('');

    const handleAddModel = () => {
        if (newModel && !models.includes(newModel)) {
            setModels([...models, newModel]);
            setNewModel('');
        }
    };
    const handleEditModel = (index: number) => {
        setEditingModelIndex(index);
        setEditingModel(models[index]);
    };

    const handleSaveEditedModel = () => {
        if (editingModelIndex !== null && editingModel) {
            const updatedModels = [...models];
            updatedModels[editingModelIndex] = editingModel;
            setModels(updatedModels);
            setEditingModelIndex(null);
            setEditingModel('');
        }
    };

    const handleCancelModelEdit = () => {
        setEditingModelIndex(null);
        setEditingModel('');
    };

    const handleAddTool = () => {
        if (newTool.function.name && newTool.function.description) {
            setTools([...tools, newTool]);
            setNewTool({
                type: "function",
                function: {
                    name: "",
                    description: "",
                    parameters: {}
                }
            });
        }
    };

    const handleDeleteModel = (modelToDelete: string) => {
        setModels(models.filter(model => model !== modelToDelete));
    };

    const handleDeleteTool = (index: number) => {
        const updatedTools = tools.filter((_, i) => i !== index);
        setTools(updatedTools);
        const deletedTool = tools[index];
        const updatedToolFunctions = { ...toolFunctions };
        delete updatedToolFunctions[deletedTool.function.name];
        setToolFunctions(updatedToolFunctions);
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

    const handleEditTool = (index: number) => {
        setEditingIndex(index);
        setEditingTool(tools[index]);
    };

    const handleSaveEditedTool = () => {
        if (editingIndex !== null) {
            const updatedTools = [...tools];
            updatedTools[editingIndex] = editingTool;
            setTools(updatedTools);
            setEditingIndex(null);
            setEditingTool({
                type: "function",
                function: {
                    name: "",
                    description: "",
                    parameters: {}
                }
            });
        }
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingTool({
            type: "function",
            function: {
                name: "",
                description: "",
                parameters: {}
            }
        });
    };

    if (!isModalOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content">
                <button className="close-button" onClick={closeModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <h2>Model Settings</h2>
                <ul className="model-list">
                    {models.map((model, index) => (
                        <li key={index}>
                            {editingModelIndex === index ? (
                                <div className="model-edit">
                                    <input
                                        type="text"
                                        value={editingModel}
                                        onChange={(e) => setEditingModel(e.target.value)}
                                        className="model-input"
                                    />
                                    <div className="model-edit-buttons">
                                        <button onClick={handleSaveEditedModel} className="save-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                <polyline points="7 3 7 8 15 8"></polyline>
                                            </svg>
                                            保存
                                        </button>
                                        <button onClick={handleCancelModelEdit} className="cancel-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                                <line x1="9" y1="9" x2="15" y2="15"></line>
                                            </svg>
                                            キャンセル
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className="model-name">{model}</span>
                                    <div className="model-buttons">
                                        <button onClick={() => handleEditModel(index)} className="edit-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <button onClick={() => handleDeleteModel(model)} className="delete-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                    </div>
                                </>
                            )}
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
                    {tools.map((tool, index) => (
                        <li key={index}>
                            {editingIndex === index ? (
                                <div className="tool-edit">
                                    <input
                                        type="text"
                                        value={editingTool.function.name}
                                        onChange={(e) => setEditingTool({ ...editingTool, function: { ...editingTool.function, name: e.target.value } })}
                                        className="tool-input"
                                        placeholder="Tool name"
                                    />
                                    <textarea
                                        value={editingTool.function.description}
                                        onChange={(e) => setEditingTool({ ...editingTool, function: { ...editingTool.function, description: e.target.value } })}
                                        className="tool-input"
                                        placeholder="Tool description"
                                    />
                                    <textarea
                                        value={JSON.stringify(editingTool.function.parameters, null, 2)}
                                        onChange={(e) => {
                                            try {
                                                const parsedParameters = JSON.parse(e.target.value);
                                                setEditingTool({ ...editingTool, function: { ...editingTool.function, parameters: parsedParameters } });
                                            } catch (error) {
                                                console.error('Invalid JSON:', error);
                                            }
                                        }}
                                        className="tool-input"
                                        placeholder="Tool parameters (JSON)"
                                    />
                                    <div className="tool-edit-buttons">
                                        <button onClick={handleSaveEditedTool} className="save-button">保存</button>
                                        <button onClick={handleCancelEdit} className="cancel-button">キャンセル</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className="tool-name">{tool.function.name}</span>
                                    <div className="tool-buttons">
                                        <button onClick={() => handleEditTool(index)} className="edit-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        <button onClick={() => handleDeleteTool(index)} className="delete-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
                {editingIndex === null && (
                    <div className="tool-input-area">
                        <input
                            type="text"
                            value={newTool.function.name}
                            onChange={(e) => setNewTool({ ...newTool, function: { ...newTool.function, name: e.target.value } })}
                            placeholder="Tool Name"
                            className="function-input"
                        />
                        <textarea
                            value={newTool.function.description}
                            onChange={(e) => setNewTool({ ...newTool, function: { ...newTool.function, description: e.target.value } })}
                            placeholder="Tool Description"
                            className="function-input"
                        />
                        <textarea
                            value={JSON.stringify(newTool.function.parameters, null, 2)}
                            onChange={(e) => {
                                try {
                                    const parsedParameters = JSON.parse(e.target.value);
                                    setNewTool({ ...newTool, function: { ...newTool.function, parameters: parsedParameters } });
                                } catch (error) {
                                    console.error('Invalid JSON:', error);
                                }
                            }}
                            placeholder="Tool Parameters (JSON)"
                            className="tool-input"
                        />
                        <button onClick={handleAddTool} className="add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Tool
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
}
