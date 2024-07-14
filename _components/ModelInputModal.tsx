import React, { useState } from "react";

export default function ModelInputModal({ models, setModels, isModalOpen, closeModal }) {
    const [newModel, setNewModel] = useState('');

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
                    <h2>Settings</h2>
                    <ul>
                        {models.map((model, index) => (
                            <li key={index}>{model}</li>
                        ))}
                    </ul>
                    <input
                        type="text"
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        placeholder="Add new model"
                    />
                    <button onClick={handleAddModel}>Add Model</button>
                </div>
            </div>
        )
    );
};