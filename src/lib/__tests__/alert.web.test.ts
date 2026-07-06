import { Alert } from '../alert.web';

/**
 * The web Alert shim maps RN's Alert API onto window.alert / window.confirm, because
 * react-native-web's Alert.alert is a no-op. These lock in the button-routing so confirms
 * and notices actually fire on web (the bug that made Save / Remove / etc. do nothing).
 */
describe('Alert (web shim)', () => {
  const realAlert = window.alert;
  const realConfirm = window.confirm;
  afterEach(() => {
    window.alert = realAlert;
    window.confirm = realConfirm;
  });

  it('a single-button alert shows a notice and fires its onPress', () => {
    window.alert = jest.fn();
    const onPress = jest.fn();
    Alert.alert('Title', 'Body', [{ text: 'OK', onPress }]);
    expect(window.alert).toHaveBeenCalledWith('Title\n\nBody');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a no-button alert still shows a notice', () => {
    window.alert = jest.fn();
    Alert.alert('Heads up', 'Something happened');
    expect(window.alert).toHaveBeenCalledWith('Heads up\n\nSomething happened');
  });

  it('confirm accepted fires the primary (non-cancel) action', () => {
    window.confirm = jest.fn(() => true);
    const cancel = jest.fn();
    const save = jest.fn();
    Alert.alert('Save measurements', '2 items still empty — save anyway?', [
      { text: 'Keep measuring', style: 'cancel', onPress: cancel },
      { text: 'Save anyway', onPress: save },
    ]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('confirm dismissed fires the cancel action, not the primary', () => {
    window.confirm = jest.fn(() => false);
    const cancel = jest.fn();
    const remove = jest.fn();
    Alert.alert('Remove photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
    expect(remove).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
