import { render } from '@testing-library/react-native'
import App from '../App'

describe('App', () => {
  it('renders without crashing', async () => {
    const { findAllByText } = render(<App />)
    const elements = await findAllByText('Log in')
    expect(elements.length).toBeGreaterThan(0)
  })
})
