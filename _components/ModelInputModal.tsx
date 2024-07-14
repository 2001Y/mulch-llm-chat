import React, { useState } from "react";

interface ModelInputModalProps {
    models: string[];
    setModels: React.Dispatch<React.SetStateAction<string[]>>;
    isModalOpen: boolean;
    closeModal: () => void;
}

export default function ModelInputModal({ models, setModels, isModalOpen, closeModal }: ModelInputModalProps) {
    const [newModel, setNewModel] = useState<string>('');

    const handleAddModel = () => {
        if (newModel && !models.includes(newModel)) {
            setModels([...models, newModel]);
            setNewModel('');
        }
    };

    return (
        isModalOpen && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <span className="close" onClick={closeModal}>&times;</span>
                    <h2>設定</h2>
                    <ul>
                        {models.map((model, index) => (
                            <li key={index}>{model}</li>
                        ))}
                    </ul>
                    <input
                        type="text"
                        value={newModel}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewModel(e.target.value)}
                        placeholder="新しいモデルを追加"
                    />
                    <button onClick={handleAddModel}>モデルを追加</button>
                </div>
            </div>
        )
    );
}