import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';

import Countdown from './Countdown';
import CountdownJs, { CountdownProps, CountdownState } from './CountdownJs';
import { calcTimeDelta, formatTimeDelta } from './utils';
import { mockDateNow, defaultStats } from './fixtures';

const { now, timeDiff } = mockDateNow();

describe('<Countdown />', () => {
  jest.useFakeTimers();

  let wrapper: ReactWrapper<CountdownProps, CountdownState, Countdown>;
  let obj: CountdownJs;
  let countdownDate: number;
  const countdownMs = 10000;

  function getCountdownJsInstance(): CountdownJs {
    return wrapper.instance().countdown;
  }

  function getCountdownJsState(): CountdownState {
    return getCountdownJsInstance().getState();
  }

  beforeEach(() => {
    Date.now = now;
    const date = Date.now() + countdownMs;
    countdownDate = date;
    wrapper = mount(<Countdown date={date} />);
    obj = getCountdownJsInstance();
  });

  it('should render a simple countdown', () => {
    wrapper = mount(<Countdown date={Date.now() + timeDiff} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render custom renderer output', () => {
    wrapper = mount(
      <Countdown
        date={Date.now() + timeDiff}
        renderer={(props) => (
          <div>
            {props.days}
            {props.hours}
            {props.minutes}
            {props.seconds}
          </div>
        )}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('should render and unmount component on countdown end', () => {
    const zeroPadTime = 0;

    class Completionist extends React.PureComponent<{
      readonly name: string;
      readonly children: React.ReactNode;
    }> {
      render() {
        const { name, children } = this.props;
        return (
          <div>
            Completed! {name} {children}
          </div>
        );
      }
    }

    let completionist;
    Completionist.prototype.componentDidMount = jest.fn();

    wrapper = mount(
      <Countdown date={Date.now() + timeDiff} zeroPadTime={zeroPadTime}>
        <Completionist
          ref={(el) => {
            completionist = el;
          }}
          name="master"
        >
          Another child
        </Completionist>
      </Countdown>
    );
    expect(Completionist.prototype.componentDidMount).not.toBeCalled();
    expect(wrapper).toMatchSnapshot();

    // Forward in time
    wrapper.setProps({ date: 0 });
    expect(wrapper.state().timeDelta.completed).toBe(true);
    expect(wrapper.props().children!.type).toBe(Completionist);
    expect(Completionist.prototype.componentDidMount).toBeCalled();

    const computedProps = { ...wrapper.props() };
    delete computedProps.children;

    obj = getCountdownJsInstance();
    const { timeDelta } = wrapper.state();
    expect(completionist.props).toEqual({
      countdown: {
        ...timeDelta,
        api: obj.getApi(),
        props: getCountdownJsInstance().getProps(),
        formatted: formatTimeDelta(timeDelta, { zeroPadTime }),
      },
      name: 'master',
      children: 'Another child',
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should render with daysInHours => true', () => {
    wrapper = mount(<Countdown date={Date.now() + timeDiff} daysInHours />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should render with zeroPadDays => 3', () => {
    wrapper = mount(<Countdown date={Date.now() + 10 * 86400 * 1000} zeroPadDays={3} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('should trigger onTick and onComplete callbacks', () => {
    const onTick = jest.fn((stats) => {
      expect(stats).toEqual(calcTimeDelta(countdownDate));
    });

    const onComplete = jest.fn((stats) => {
      expect(stats.total).toEqual(0);
    });

    wrapper.setProps({ onTick, onComplete });
    expect(onTick).not.toBeCalled();

    // Forward 6s in time
    now.mockReturnValue(countdownDate - 6000);
    jest.advanceTimersByTime(6000);
    expect(onTick.mock.calls.length).toBe(6);
    expect(getCountdownJsState().timeDelta.total).toBe(6000);

    wrapper.update();
    expect(wrapper).toMatchSnapshot();

    // Forward 3 more seconds
    now.mockReturnValue(countdownDate - 1000);
    jest.advanceTimersByTime(3000);
    expect(onTick.mock.calls.length).toBe(9);
    expect(getCountdownJsState().timeDelta.total).toBe(1000);
    expect(getCountdownJsState().timeDelta.completed).toBe(false);

    // The End: onComplete callback gets triggered instead of the onTick callback
    now.mockReturnValue(countdownDate);
    jest.advanceTimersByTime(1000);
    expect(onTick.mock.calls.length).toBe(9);
    expect(onTick).toBeCalledWith({
      ...defaultStats,
      total: 1000,
      seconds: 1,
    });

    expect(onComplete.mock.calls.length).toBe(1);
    expect(onComplete).toBeCalledWith({ ...defaultStats, completed: true });
    expect(getCountdownJsState().timeDelta.completed).toBe(true);
  });

  it('should run through the controlled component by updating the date prop', () => {
    wrapper = mount(<Countdown date={1000} controlled />);
    obj = getCountdownJsInstance();
    const api = obj.getApi();
    const countdownJsObj = getCountdownJsInstance();

    expect(countdownJsObj.interval).toBeUndefined();
    expect(getCountdownJsState().timeDelta.completed).toBe(false);
    expect(api.isCompleted()).toBe(false);

    wrapper.setProps({ date: 0 });
    expect(getCountdownJsState().timeDelta.total).toBe(0);
    expect(getCountdownJsState().timeDelta.completed).toBe(true);
    expect(api.isCompleted()).toBe(true);
  });

  it('should only re-set time delta state when props have changed', () => {
    const root = document.createElement('div');
    wrapper = mount(<Countdown date={1000} />, { attachTo: root });
    const countdownJsObj = getCountdownJsInstance();
    countdownJsObj.setTimeDeltaState = jest.fn();

    function mergeProps(partialProps: Partial<CountdownProps>): CountdownProps {
      return { ...wrapper.props(), ...partialProps };
    }

    wrapper.setProps(mergeProps({ date: 500 }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(1);

    wrapper.setProps(mergeProps({ intervalDelay: 999 }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(2);

    wrapper.setProps(mergeProps({ date: 500 }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(2);

    wrapper.setProps(mergeProps({ precision: NaN }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(3);

    wrapper.setProps(mergeProps({ precision: NaN }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(3);

    wrapper.setProps(mergeProps({ precision: 3 }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(4);

    wrapper.setProps(mergeProps({ date: 750 }));
    expect(countdownJsObj.setTimeDeltaState).toHaveBeenCalledTimes(5);
  });

  it('should not (try to) set state after component unmount', () => {
    const countdownJsObj = getCountdownJsInstance();
    expect(getCountdownJsState().timeDelta.completed).toBe(false);

    now.mockReturnValue(countdownDate - 6000);
    jest.advanceTimersByTime(6000);
    expect(countdownJsObj.mounted).toBe(true);
    expect(getCountdownJsState().timeDelta.total).toBe(6000);

    wrapper.unmount();

    now.mockReturnValue(countdownDate - 3000);
    jest.advanceTimersByTime(3000);
    expect(countdownJsObj.mounted).toBe(false);
    expect(countdownJsObj.getState().timeDelta.total).toBe(6000);

    countdownJsObj.setTimeDeltaState(defaultStats);
    expect(countdownJsObj.getState().timeDelta).not.toEqual(defaultStats);
  });

  it('should set countdown status to STOPPED if a prop-update occurs that updates a completed countdown', () => {
    wrapper = mount(<Countdown date={countdownDate} />);
    obj = getCountdownJsInstance();
    const api = obj.getApi();

    expect(api.isStarted()).toBe(true);

    wrapper.setProps({ date: countdownDate + 1000 });
    expect(api.isStarted()).toBe(true);

    wrapper.setProps({ date: 0 });
    expect(api.isCompleted()).toBe(true);

    wrapper.setProps({ date: countdownDate + 1000 });
    expect(api.isStopped()).toBe(true);
  });

  it('should pause => start => pause => stop and restart countdown', () => {
    const spies = {
      onMount: jest.fn(),
      onStart: jest.fn(),
      onPause: jest.fn(),
      onStop: jest.fn(),
    };
    wrapper = mount(<Countdown date={countdownDate} {...spies} />);
    obj = getCountdownJsInstance();
    const api = obj.getApi();

    expect(obj.offsetStartTimestamp).toBe(0);
    expect(obj.offsetTime).toBe(0);

    expect(api.isStarted()).toBe(true);
    expect(api.isPaused()).toBe(false);
    expect(api.isStopped()).toBe(false);
    expect(api.isCompleted()).toBe(false);
    expect(spies.onMount).toHaveBeenCalledTimes(1);
    expect(spies.onMount).toHaveBeenCalledWith({
      completed: false,
      total: 10000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 10,
      milliseconds: 0,
    });
    expect(spies.onStart).toHaveBeenCalledTimes(1);
    expect(spies.onPause).toHaveBeenCalledTimes(0);
    expect(spies.onStop).toHaveBeenCalledTimes(0);

    let runMs = 2000;
    const nowBeforePause = countdownDate - (countdownMs - runMs);
    now.mockReturnValue(nowBeforePause);
    jest.advanceTimersByTime(runMs);
    expect(getCountdownJsState().timeDelta.total).toBe(countdownMs - runMs);

    api.pause();
    expect(api.isStarted()).toBe(false);
    expect(api.isPaused()).toBe(true);
    expect(api.isStopped()).toBe(false);
    expect(api.isCompleted()).toBe(false);
    expect(spies.onMount).toHaveBeenCalledTimes(1);
    expect(spies.onStart).toHaveBeenCalledTimes(1);
    expect(spies.onPause).toHaveBeenCalledTimes(1);
    expect(spies.onPause).toHaveBeenCalledWith({
      completed: false,
      total: 8000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 8,
      milliseconds: 0,
    });
    expect(spies.onStop).toHaveBeenCalledTimes(0);

    // Calling pause() a 2nd time while paused should return early
    api.pause();
    expect(api.isPaused()).toBe(true);
    expect(spies.onPause).toHaveBeenCalledTimes(1);
    expect(spies.onPause).toHaveBeenCalledWith(getCountdownJsInstance().calcTimeDelta());

    runMs += 2000;
    const pausedMs = 2000;
    now.mockReturnValue(countdownDate - (countdownMs - runMs));
    jest.advanceTimersByTime(runMs);
    expect(countdownMs - runMs + pausedMs).toBe(8000);
    expect(wrapper.state().timeDelta.total).toBe(8000);
    expect(obj.offsetStartTimestamp).toBe(nowBeforePause);
    expect(obj.offsetTime).toBe(0);

    api.start();
    expect(api.isStarted()).toBe(true);
    expect(api.isPaused()).toBe(false);
    expect(api.isStopped()).toBe(false);
    expect(api.isCompleted()).toBe(false);
    expect(spies.onMount).toHaveBeenCalledTimes(1);
    expect(spies.onStart).toHaveBeenCalledTimes(2);
    expect(spies.onStart).toHaveBeenCalledWith({
      completed: false,
      total: 8000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 8,
      milliseconds: 0,
    });
    expect(spies.onPause).toHaveBeenCalledTimes(1);
    expect(spies.onStop).toHaveBeenCalledTimes(0);

    expect(wrapper.state().timeDelta.total).toBe(8000);
    expect(obj.offsetStartTimestamp).toBe(0);
    expect(obj.offsetTime).toBe(pausedMs);

    runMs += 1000;
    now.mockReturnValue(countdownDate - (countdownMs - runMs));
    jest.advanceTimersByTime(runMs);
    expect(countdownMs - runMs + pausedMs).toBe(7000);
    expect(wrapper.state().timeDelta.total).toBe(7000);
    expect(obj.offsetStartTimestamp).toBe(0);
    expect(obj.offsetTime).toBe(pausedMs);

    runMs += 1000;
    now.mockReturnValue(countdownDate - (countdownMs - runMs));
    jest.advanceTimersByTime(runMs);

    api.pause();
    expect(obj.offsetStartTimestamp).toBe(now());
    expect(obj.offsetTime).toBe(2000);

    expect(wrapper.state().timeDelta).toEqual({
      completed: false,
      total: 6000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 6,
      milliseconds: 0,
    });

    runMs += 1000;
    now.mockReturnValue(countdownDate - (countdownMs - runMs));
    jest.advanceTimersByTime(runMs);

    api.stop();
    expect(obj.offsetStartTimestamp).toBe(now());
    expect(obj.offsetTime).toBe(runMs);

    expect(api.isStarted()).toBe(false);
    expect(api.isPaused()).toBe(false);
    expect(api.isStopped()).toBe(true);
    expect(api.isCompleted()).toBe(false);
    expect(spies.onMount).toHaveBeenCalledTimes(1);
    expect(spies.onStart).toHaveBeenCalledTimes(2);
    expect(spies.onPause).toHaveBeenCalledTimes(2);
    expect(spies.onStop).toHaveBeenCalledTimes(1);
    expect(spies.onStop).toHaveBeenCalledWith({
      completed: false,
      total: 10000,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 10,
      milliseconds: 0,
    });

    // Calling stop() a 2nd time while stopped should return early
    api.stop();
    expect(api.isStopped()).toBe(true);
    expect(spies.onStop).toHaveBeenCalledTimes(1);

    api.start();

    runMs += 10000;
    now.mockReturnValue(countdownDate + runMs + pausedMs);
    jest.advanceTimersByTime(countdownMs + pausedMs);
    expect(wrapper.state().timeDelta.total).toBe(0);
    expect(wrapper.state().timeDelta.completed).toBe(true);
    expect(api.isCompleted()).toBe(true);
    expect(obj.offsetStartTimestamp).toBe(0);
    expect(obj.offsetTime).toBe(7000);

    expect(spies.onMount).toHaveBeenCalledTimes(1);
    expect(spies.onStart).toHaveBeenCalledTimes(3);
    expect(spies.onPause).toHaveBeenCalledTimes(2);
    expect(spies.onStop).toHaveBeenCalledTimes(1);
  });

  it('should update component when pure', () => {
    wrapper = mount(<Countdown pure date={countdownDate} />);
    const countdownJsObj = getCountdownJsInstance();
    expect(countdownJsObj.getProps().date).toBe(countdownDate);

    wrapper.setProps({ date: 0 });
    expect(countdownJsObj.getProps().date).toBe(0);
  });

  it('should not update component when impure', () => {
    wrapper = mount(<Countdown pure={false} date={countdownDate} />);
    const countdownJsObj = getCountdownJsInstance();
    expect(countdownJsObj.getProps().date).toBe(countdownDate);

    wrapper.setProps({ date: 0 });
    expect(countdownJsObj.getProps().date).not.toBe(0);
  });

  it('should auto start countdown', () => {
    const spies = {
      onStart: jest.fn(),
      onPause: jest.fn(),
    };
    wrapper = mount(<Countdown date={countdownDate} autoStart={true} {...spies} />);
    obj = getCountdownJsInstance();
    const api = obj.getApi();

    expect(spies.onStart).toHaveBeenCalledTimes(1);
    expect(spies.onPause).toHaveBeenCalledTimes(0);
    expect(api.isPaused()).toBe(false);
    expect(obj.offsetStartTimestamp).toBe(0);
    expect(obj.offsetTime).toBe(0);

    api.pause();
    expect(spies.onStart).toHaveBeenCalledTimes(1);
    expect(spies.onPause).toHaveBeenCalledTimes(1);
    expect(api.isPaused()).toBe(true);
    expect(obj.offsetStartTimestamp).toBe(countdownDate - countdownMs);
    expect(obj.offsetTime).toBe(0);
  });

  it('should not auto start countdown', () => {
    const spies = {
      onStart: jest.fn(),
    };
    wrapper = mount(<Countdown date={countdownDate} autoStart={false} {...spies} />);
    obj = getCountdownJsInstance();
    const api = obj.getApi();

    expect(spies.onStart).toHaveBeenCalledTimes(0);
    expect(api.isStarted()).toBe(false);
    expect(api.isPaused()).toBe(false);
    expect(api.isStopped()).toBe(true);
    expect(api.isCompleted()).toBe(false);
    expect(obj.offsetStartTimestamp).toBe(countdownDate - countdownMs);
    expect(obj.offsetTime).toBe(0);

    api.start();
    expect(spies.onStart).toHaveBeenCalledTimes(1);
    expect(api.isStarted()).toBe(true);
    expect(api.isPaused()).toBe(false);
    expect(api.isStopped()).toBe(false);
    expect(api.isCompleted()).toBe(false);
    expect(obj.offsetStartTimestamp).toBe(0);
    expect(obj.offsetTime).toBe(0);

    // Calling start() a 2nd time while started should return early
    api.start();
    expect(spies.onStart).toHaveBeenCalledTimes(1);
  });

  it('should continuously call the renderer if date is in the future', () => {
    const renderer = jest.fn(() => <div />);
    wrapper = mount(<Countdown date={countdownDate} renderer={renderer} />);
    expect(renderer).toHaveBeenCalledTimes(2);

    // Forward 1s
    now.mockReturnValue(countdownDate - 9000);
    jest.advanceTimersByTime(1000);
    expect(renderer).toHaveBeenCalledTimes(3);

    // Forward 2s
    now.mockReturnValue(countdownDate - 8000);
    jest.advanceTimersByTime(1000);
    expect(renderer).toHaveBeenCalledTimes(4);

    expect(wrapper.state().timeDelta.total).toBe(8000);
    expect(wrapper.state().timeDelta.completed).toBe(false);
  });

  it('should stop immediately if date is in the past', () => {
    const renderer = jest.fn(() => <div />);
    countdownDate = Date.now() - 10000;
    wrapper = mount(<Countdown date={countdownDate} renderer={renderer} />);
    expect(renderer).toHaveBeenCalledTimes(2);

    // Forward 1s
    now.mockReturnValue(countdownDate - 9000);
    jest.advanceTimersByTime(1000);
    expect(renderer).toHaveBeenCalledTimes(2);

    // Forward 2s
    now.mockReturnValue(countdownDate - 8000);
    jest.advanceTimersByTime(1000);
    expect(renderer).toHaveBeenCalledTimes(2);

    expect(wrapper.state().timeDelta.total).toBe(0);
    expect(wrapper.state().timeDelta.completed).toBe(true);
  });

  it('should not stop the countdown and go into overtime', () => {
    wrapper = mount(
      <Countdown date={countdownDate} overtime={true}>
        <div>Completed? Overtime!</div>
      </Countdown>
    );
    obj = getCountdownJsInstance();
    const api = obj.getApi();

    // Forward 9s
    now.mockReturnValue(countdownDate - 1000);
    jest.advanceTimersByTime(9000);

    expect(wrapper.text()).toMatchInlineSnapshot(`"00:00:00:01"`);

    // Forward 1s
    now.mockReturnValue(countdownDate);
    jest.advanceTimersByTime(1000);

    expect(wrapper.text()).toMatchInlineSnapshot(`"00:00:00:00"`);
    expect(wrapper.state().timeDelta.total).toBe(0);
    expect(wrapper.state().timeDelta.completed).toBe(true);
    expect(api.isCompleted()).toBe(false);

    // Forward 1s (overtime)
    now.mockReturnValue(countdownDate + 1000);
    jest.advanceTimersByTime(1000);

    expect(wrapper.text()).toMatchInlineSnapshot(`"-00:00:00:01"`);
    expect(wrapper.state().timeDelta.total).toBe(-1000);
    expect(wrapper.state().timeDelta.completed).toBe(true);
    expect(api.isCompleted()).toBe(false);
  });

  afterEach(() => {
    try {
      wrapper.detach();
    } catch (e) {
      // Continue...
    }
  });
});
