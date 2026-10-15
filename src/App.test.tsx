import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { syntheticExamples } from './lib/api';

vi.mock('./components/AnatomyExplorer', () => ({
  default: () => <div data-testid="anatomy-explorer">3D Cardiovascular Explorer Mock</div>,
}));

const mockModelInfo = {
  name: 'CardioVision AI Heart Disease Prototype',
  model_type: 'LogisticRegression',
  target_definition: 'Binary target: 0 means <50% diameter narrowing; 1 means presence of angiographic disease',
  features: [
    { name: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 100, description: 'Age in years.' },
    { name: 'sex', label: 'Sex', type: 'categorical', options: [{ value: 0, label: 'Female' }, { value: 1, label: 'Male' }], description: 'Sex.' },
    { name: 'cp', label: 'Chest pain type', type: 'categorical', options: [{ value: 1, label: 'Typical angina' }], description: 'CP.' },
    { name: 'trestbps', label: 'Resting BP', type: 'number', min: 80, max: 220, description: 'BP.' },
    { name: 'chol', label: 'Serum cholesterol', type: 'number', min: 100, max: 650, description: 'Chol.' },
    { name: 'fbs', label: 'Fasting sugar', type: 'categorical', options: [{ value: 0, label: 'False' }], description: 'FBS.' },
    { name: 'restecg', label: 'Resting ECG', type: 'categorical', options: [{ value: 0, label: 'Normal' }], description: 'ECG.' },
    { name: 'thalach', label: 'Max heart rate', type: 'number', min: 60, max: 230, description: 'HR.' },
    { name: 'exang', label: 'Exercise angina', type: 'categorical', options: [{ value: 0, label: 'No' }], description: 'Exang.' },
    { name: 'oldpeak', label: 'ST depression', type: 'number', min: 0, max: 7, description: 'Oldpeak.' },
    { name: 'slope', label: 'ST slope', type: 'categorical', options: [{ value: 1, label: 'Upsloping' }], description: 'Slope.' },
    { name: 'ca', label: 'Vessels colored', type: 'number', min: 0, max: 3, description: 'CA.' },
    { name: 'thal', label: 'Thalassemia', type: 'categorical', options: [{ value: 3, label: 'Normal' }], description: 'Thal.' },
  ],
  dataset: { rows: 303, features: 13, target_positive_count: 139, target_negative_count: 164, missing_values: { ca: 4, thal: 2 } },
  split: { strategy: 'Stratified 80/20', train_rows: 242, test_rows: 61 },
  limitations: ['Research prototype only.'],
};

const mockEvaluation = {
  holdout: {
    metrics: { roc_auc: 0.958, accuracy: 0.869, sensitivity: 0.929, specificity: 0.818, f1: 0.867 },
    confusion_matrix: { tn: 27, fp: 6, fn: 2, tp: 26 },
    roc_curve: [{ fpr: 0, tpr: 0 }, { fpr: 0.1, tpr: 0.9 }, { fpr: 1, tpr: 1 }],
    calibration: [{ bin: '(0, 0.2]', mean_predicted_probability: 0.1, observed_rate: 0.1, count: 12 }],
  },
  cross_validation: {
    roc_auc: { mean: 0.907, std: 0.018 },
    f1: { mean: 0.831, std: 0.022 },
  },
  dataset: { rows: 303, source_url: 'uci' },
  split: { strategy: 'holdout', train_rows: 242, test_rows: 61 },
  limitations: [],
};

const mockPrediction = {
  prediction: 0,
  probability: 0.0169,
  threshold: 0.5,
  label: 'Disease absence prototype',
  target_definition: 'Binary target: 0 means <50% diameter narrowing',
  limitations: ['Non-diagnostic demonstration.'],
};

const mockExplanation = {
  probability: 0.0169,
  logit: -4.06,
  intercept: -0.1375,
  method: 'Logistic regression log-odds decomposition',
  contributions: [
    { feature: 'ca', contribution: -0.85, direction: 'decreases model score', absolute: 0.85 },
    { feature: 'thal', contribution: -0.61, direction: 'decreases model score', absolute: 0.61 },
  ],
  detailed_contributions: [
    { transformed_feature: 'ca', base_feature: 'ca', value: 0, coefficient: 1.135, contribution: 0 },
  ],
  global_importance: [
    { feature: 'ca', importance: 1.135, coefficients: [1.135] },
  ],
  caution: 'Feature contributions describe this model calculation.',
};

beforeEach(() => {
  global.fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/model-info')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockModelInfo),
      } as Response);
    }
    if (url.endsWith('/evaluation')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockEvaluation),
      } as Response);
    }
    if (url.endsWith('/predict')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPrediction),
      } as Response);
    }
    if (url.endsWith('/explain')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockExplanation),
      } as Response);
    }
    if (url.endsWith('/auth/me')) {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthenticated' }),
      } as Response);
    }
    if (url.includes('/assessments')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.endsWith('/assessments')
              ? []
              : {
                  id: 'CV-TEST-123',
                  assessment_id: 'CV-TEST-123',
                  patient_name: 'Test',
                  prediction: mockPrediction,
                  review: null,
                }
          ),
      } as Response);
    }
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  }) as typeof fetch;
});

describe('CardioVision AI Full-Stack App Test Suite', () => {
  test('renders Entry Portal Gateway with exactly two primary destination options and transitions to patient experience', async () => {
    render(<App />);
    expect(screen.getByText('CardioVision AI')).toBeInTheDocument();
    expect(screen.getByText(/The Science of Seeing the Heart/i)).toBeInTheDocument();
    expect(screen.getByText('Patient Portal')).toBeInTheDocument();
    expect(screen.getByText('Doctor Workstation')).toBeInTheDocument();
    // Third card removed as primary destination option
    expect(screen.queryByText('Clinical AI Explorer')).toBeNull();

    // Transition into patient portal experience
    const enterBtn = screen.getByRole('button', { name: /Enter Patient Experience/i });
    fireEvent.click(enterBtn);

    // Verify main app dashboard renders
    expect(await screen.findByText('Clinical Input & Risk Prediction')).toBeInTheDocument();
    expect(screen.getByText('Model Evaluation & Validation Metrics')).toBeInTheDocument();
    expect(screen.getByTestId('anatomy-explorer')).toBeInTheDocument();
  });

  test('submits clinical input and renders real-time prediction and explanation', async () => {
    render(<App />);
    // Transition from entry gateway into app
    const enterBtn = screen.getByRole('button', { name: /Enter Patient Experience/i });
    fireEvent.click(enterBtn);

    // Wait for form to mount after /model-info loads
    const submitBtn = await screen.findByRole('button', { name: /Evaluate Patient Risk Profile/i });
    expect(submitBtn).toBeInTheDocument();

    // Click submit
    fireEvent.click(submitBtn);

    // Verify prediction outcome
    expect(await screen.findByText('Disease absence prototype')).toBeInTheDocument();
    expect(screen.getAllByText('2%').length).toBeGreaterThanOrEqual(1);

    // Verify explanation section loaded
    expect(screen.getByText(/Prediction Explanation & Importance/i)).toBeInTheDocument();
  });

  test('handles synthetic high-risk demo loading', async () => {
    render(<App />);
    const enterBtn = screen.getByRole('button', { name: /Enter Patient Experience/i });
    fireEvent.click(enterBtn);

    const highRiskBtn = await screen.findByRole('button', { name: /High-risk demo/i });
    expect(highRiskBtn).toBeInTheDocument();
    fireEvent.click(highRiskBtn);

    // Form inputs should update
    const ageInput = screen.getByLabelText(/Age/i) as HTMLInputElement;
    expect(ageInput.value).toBe(syntheticExamples.higher_probability.age.toString());
  });
});
